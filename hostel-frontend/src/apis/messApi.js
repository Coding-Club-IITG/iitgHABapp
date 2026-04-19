import apiClient from "./client";

export const getMessWorkers = async () => {
  const response = await apiClient.get("/mess/workers");
  return response.data.workers || [];
};

export const createMessWorker = async (workerData) => {
  const response = await apiClient.post("/mess/workers", workerData);
  return response.data;
};

export const deleteMessWorker = async (id) => {
  const response = await apiClient.delete(`/mess/workers/${id}`);
  return response.data;
};

export const updateMessWorker = async (id, workerData) => {
  const response = await apiClient.put(`/mess/workers/${id}`, workerData);
  return response.data;
};

export const generateMessBill = async (billData, hostelId) => {
  const response = await apiClient.post("/mess/bill/generate", { billData, hostelId });
  return response.data;
};

export const fetchMessBill = async (hostelId, month, year) => {
  const response = await apiClient.get(`/mess/bill`, {
    params: { hostelId, month, year }
  });
  return response.data;
};

/** Download mess bill .xlsx via API (`Content-Disposition: attachment`) instead of opening OneDrive in the browser. */
export async function downloadMessBillExcel(hostelId, month, year) {
  try {
    const { data, headers } = await apiClient.get("/mess/bill/download", {
      params: { hostelId, month, year },
      responseType: "blob",
    });
    const ct = (headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      const text = await (data instanceof Blob ? data.text() : String(data));
      const j = JSON.parse(text);
      throw new Error(j.message || "Download failed");
    }
    const mime =
      (headers["content-type"] && String(headers["content-type"]).split(";")[0].trim()) ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    const cd = headers["content-disposition"];
    let name = `mess-bill-${String(month).replace(/\s+/g, "_")}-${year}.xlsx`;
    if (cd) {
      const quoted = /filename="([^"]+)"/i.exec(cd);
      const utf8 = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
      if (quoted?.[1]) {
        name = quoted[1].trim();
      } else if (utf8?.[1]) {
        try {
          name = decodeURIComponent(utf8[1]);
        } catch {
          name = utf8[1];
        }
      }
    }
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const j = JSON.parse(text);
        throw new Error(j.message || j.error || "Download failed");
      } catch (e) {
        if (e instanceof Error && e.name === "Error" && !e.response) {
          throw e;
        }
      }
      throw new Error(err.response?.statusText || "Download failed");
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export const getRebateSummary = async (month, year) => {
  const response = await apiClient.get('/leave/hostel/rebate-summary', {
    params: { month, year }
  });
  return response.data;
};

export const getSemesterRebateApplications = async (month, year) => {
  const response = await apiClient.get("/leave/hostel/semester-rebate-applications", {
    params: { month, year },
  });
  return response.data;
};

/** Fetch document bytes with hostel auth; open in a new tab so the browser PDF viewer is used. */
export async function openHostelRebateDocumentInNewTab(applicationId, type) {
  try {
    const { data, headers } = await apiClient.get(
      `/leave/hostel/applications/${applicationId}/document`,
      { params: { type }, responseType: "blob" },
    );
    const mime =
      (headers["content-type"] && String(headers["content-type"]).split(";")[0].trim()) ||
      "application/pdf";
    if (mime.includes("application/json")) {
      const text = await (data instanceof Blob ? data.text() : String(data));
      let msg = "Could not open document";
      try {
        const j = JSON.parse(text);
        msg = j.message || j.error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      URL.revokeObjectURL(url);
      throw new Error("Popup blocked — allow popups for this site to view the PDF.");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (err) {
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const j = JSON.parse(text);
        throw new Error(j.message || j.error || "Could not open document");
      } catch (e) {
        if (e instanceof Error && e.name === "Error" && !e.response) {
          throw e;
        }
      }
      throw new Error(err.response?.statusText || "Could not open document");
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export const getMyMessShutdowns = async () => {
  const response = await apiClient.get("/mess/shutdowns/my");
  return response.data.shutdowns || [];
};
