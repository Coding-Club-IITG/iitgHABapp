// lines 1-95 is mandatory to be in you respective onedrive Controller

const axios = require("axios");
const {
  getDelegatedAccessToken,
} = require("./delegatedGraphAuth.js");
require("dotenv").config();

async function requireDelegatedToken() {
  const tok = await getDelegatedAccessToken();
  if (!tok) {
    throw new Error(
      "Delegated token not available. Login as storage user and seed access+refresh tokens via /api/_debug/graph/delegated-token.",
    );
  }
  return tok;
}

async function graphGET(url, token, config = {}) {
  const { data } = await axios.get(url, {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  });
  return data;
}

async function graphPUT(url, token, body, headers = {}) {
  const { data } = await axios.put(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

async function graphPOST(url, token, body, headers = {}) {
  const { data } = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  return data;
}

function extFromMime(mime) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
}

async function getMe(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me", token);
}

async function getMyDrive(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me/drive", token);
}

async function getItemById(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,parentReference,webUrl`;
  return graphGET(url, token);
}

async function uploadToParentByName(
  token,
  parentId,
  filename,
  buffer,
  mimeType,
) {
  // console.log(filename, buffer, mimeType);
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(
    filename,
  )}:/content`;

  const data = await graphPUT(url, token, buffer, {
    "Content-Type": mimeType || "application/octet-stream",
  });

  return data; // driveItem
}

async function createOrganizationViewLink(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`;
  const data = await graphPOST(
    url,
    token,
    { type: "view", scope: "organization" },
    { "Content-Type": "application/json" },
  );

  return data?.link?.webUrl;
}


//Provide

//file.buffer
//file.mimetype
//custom file name
//FOLDER_ID of the floder you want to upload in
const uploadToOnedrive = async (buffer,mimetype,targetName,FOLDER_ID,res) => {
  let uploaded = null;  
  try {
       if (!FOLDER_ID) {
      return res
        .status(400)
        .json({ message: "FOLDER_ID is not configured" });
    }
      
        // Delegated token required to use /me/drive
        const token = await requireDelegatedToken();
      
        // Upload to OneDrive
        const uploaded = await uploadToParentByName(
          token,
          FOLDER_ID,
          targetName,
          buffer,
          mimetype,
        );
        try {
            // Create public link
            let publicUrl = null;
            try {
              publicUrl = await createOrganizationViewLink(token, uploaded.id);
            } catch (e) {
              console.error(`Link creation failed for ${prefix}:`, e.message);
            }
          
            return {
              url: publicUrl || "",
              filename: targetName,
            };
        }
        catch(err) {
            console.error("Error in creating organization view link");
            return res.status(500).json({
                message: "Error in generation of publicUrl",
                error: err.message,
            })
        }
    }
    catch(err) {
        console.error("Error in uploading document to onedrive", err);

        return res.status(500).json({
            message: "Error in uploading file to onedrive",
            error: err.message,
        })
    }

};


//If you want file.buffer from an organization view link
//This is the controller for you

//Arguements
//url of the file
//response object

const downloadFromOnedrive = async (url,res) => {
  const documentUrl = url;
  try {
    if (!documentUrl) {
      return res.status(404).json({ message: "No document URL attached" });
    }

    if (documentUrl) {
      try {

        const extensionMap = {
          "application/pdf": ".pdf",
          "image/jpeg": ".jpg",
          "image/png": ".png",
          "image/gif": ".gif",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            ".docx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx"
        };

        // Find the extension, default to .bin if unknown

        const base64Value = Buffer.from(documentUrl).toString("base64");
        const encodedUrl =
          "u!" +
          base64Value.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");

        const graphUrl = `https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/content`;

        console.log("Fetching from Graph Shares API...");

        const accessToken = await requireDelegatedToken();

        // 2. Fetch the actual binary content
        const response = await axios.get(graphUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          responseType: "arraybuffer",
        });

        const contentType =
          response.headers["content-type"] || "application/pdf";
        console.log("Content-type is", contentType);
        res.setHeader("Content-Type", contentType);
        const ext = extensionMap[contentType] || ".bin";
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="document-${Date.now()}${ext}"`,
        );

        return res.send(Buffer.from(response.data));
      } catch (e) {
        console.error("Error in fetching document", e);
        return res.status(200).json({ url: documentUrl });
      }
    }
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch Proof Document",
      error: err.message,
      status: err.response?.status,
    });
  }
};

module.exports = {uploadToOnedrive, downloadFromOnedrive};