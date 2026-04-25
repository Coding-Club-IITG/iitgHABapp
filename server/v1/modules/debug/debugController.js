import { Pool } from "pg";
import axios from "axios";

import {
  postgresUrl,
  API_VERSION,
  publicBaseUrl,
} from "../../config/default.js";
import onedrive from "../../config/onedrive.js";

import agenda from "../../utils/agenda.js";
import {
  setDelegatedTokens,
  tokenFilePath,
} from "../../utils/delegatedGraphAuth.js";

const pool = new Pool({
  connectionString: postgresUrl,
});

export const getLogs = async (req, res, next) => {
  try {
    const query = `SELECT * FROM server_logs ORDER BY timestamp DESC LIMIT 500`;
    const result = await pool.query(query);
    return res.status(200).json({ logs: result.rows });
  } catch (err) {
    return next(err);
  }
};

export const getAgendaLogs = async (req, res, next) => {
  try {
    const tableName = `agenda_logs_${API_VERSION}`;
    const query = `SELECT * FROM ${tableName} ORDER BY _id DESC LIMIT 500`;
    const result = await pool.query(query);
    return res.status(200).json({ logs: result.rows });
  } catch (err) {
    return next(err);
  }
};

export const getAgendaJobs = async (req, res, next) => {
  try {
    // Returns jobs from the db
    const jobs = await agenda.jobs({});
    return res.status(200).json({ jobs });
  } catch (err) {
    return next(err);
  }
};

export const enableAgendaJob = async (req, res, next) => {
  try {
    const { jobName } = req.body;
    if (!jobName)
      return res.status(400).json({ message: "jobName is required" });
    await agenda.enable({ name: jobName });
    return res
      .status(200)
      .json({ message: `Job ${jobName} enabled successfully` });
  } catch (err) {
    return next(err);
  }
};

export const disableAgendaJob = async (req, res, next) => {
  try {
    const { jobName } = req.body;
    if (!jobName)
      return res.status(400).json({ message: "jobName is required" });
    await agenda.disable({ name: jobName });
    return res
      .status(200)
      .json({ message: `Job ${jobName} disabled successfully` });
  } catch (err) {
    return next(err);
  }
};

export const runAgendaJob = async (req, res, next) => {
  try {
    const { jobName } = req.body;
    if (!jobName)
      return res.status(400).json({ message: "jobName is required" });
    await agenda.now(jobName);
    return res
      .status(200)
      .json({ message: `Job ${jobName} enqueued for immediate execution` });
  } catch (err) {
    return next(err);
  }
};

// Build delegated auth URLs for starting consent
function buildAuthorizeUrl() {
  // For delegated token flow, use a dedicated callback endpoint
  // Use publicBaseUrl if available, otherwise try to construct from request
  const delegatedRedirectUri = `${publicBaseUrl}/api/_debug/graph/callback`;

  const params = new URLSearchParams({
    client_id: onedrive.clientId,
    response_type: "code",
    redirect_uri: delegatedRedirectUri,
    scope:
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    prompt: "consent",
  });
  return `https://login.microsoftonline.com/${onedrive.authTenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Accept delegated tokens and save to disk for server use
export const setGraphDelegatedToken = async (req, res) => {
  try {
    const { access_token, refresh_token, expires_at } = req.body || {};
    if (!access_token || !refresh_token || !expires_at) {
      return res.status(400).json({
        message: "access_token, refresh_token, expires_at (epoch ms) required",
      });
    }
    await setDelegatedTokens({ access_token, refresh_token, expires_at });
    return res
      .status(200)
      .json({ message: "Delegated tokens saved", path: tokenFilePath });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to save delegated tokens",
      error: String(e.message || e),
    });
  }
};

// Start delegated auth (prints URL)
export const startGraphAuth = (req, res) => {
  if (!onedrive.clientId) {
    return res.status(400).json({ message: "CLIENT_ID missing" });
  }
  const url = buildAuthorizeUrl();
  return res.status(200).json({ authorizeUrl: url });
};

// Delegated auth callback (exchange code -> tokens)
export const graphAuthCallback = async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing code");
    const tokenUrl = `https://login.microsoftonline.com/${
      onedrive.authTenant || onedrive.tenantId || "common"
    }/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", onedrive.clientId);
    if (onedrive.clientSecret)
      params.append("client_secret", onedrive.clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    // Use the same redirect URI that was used in the authorization request
    const delegatedRedirectUri = `${publicBaseUrl}/api/_debug/graph/callback`;
    params.append("redirect_uri", delegatedRedirectUri);
    params.append(
      "scope",
      (onedrive.graphUserScopes || []).join(" ") || "offline_access User.Read",
    );

    const { data } = await axios.post(tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
    await setDelegatedTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    });
    res
      .status(200)
      .send(
        `Delegated tokens saved at ${tokenFilePath}. You can close this window.`,
      );
  } catch (e) {
    res.status(500).send(`Failed to exchange code: ${e.message}`);
  }
};
