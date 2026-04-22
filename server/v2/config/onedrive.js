const settings = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  tenantId: process.env.TENANT_ID, // Resource tenant (your org tenant)
  authTenant: process.env.AUTH_TENANT || process.env.TENANT_ID || "common", // Authority to use for auth flows

  graphTokenPath: process.env.GRAPH_DELEGATED_TOKEN_PATH,
  // Delegated scopes. Default to minimum required for /me/drive uploads.
  graphUserScopes: (process.env.GRAPH_SCOPES || "User.Read offline_access")
    .split(/\s+/)
    .filter(Boolean),

  // OAuth redirect URI for delegated consent (must match app registration)
  redirectUri: process.env.REDIRECT_URI,

  // Additional required values for uploads
  driveId: process.env.ONEDRIVE_DRIVE_ID, // optional, not used with /me/drive
  profilePicsFolderId: process.env.ONEDRIVE_PROFILE_PICS_FOLDER_ID,
  leaveFolderId: process.env.ONEDRIVE_LEAVE_FOLDER_ID,
  reportsFolderId: process.env.ONEDRIVE_REPORTS_FOLDER_ID,
  festivalFolderId: process.env.ONEDRIVE_FESTIVAL_FOLDER_ID,
};

export default settings;
