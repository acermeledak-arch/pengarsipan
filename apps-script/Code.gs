/**
 * ============================================
 * Web Pengarsipan Siswa - Google Apps Script
 * ============================================
 * 
 * SETUP:
 * 1. Buka https://script.google.com
 * 2. Buat project baru
 * 3. Copy-paste seluruh kode ini
 * 4. Ganti FOLDER_ID dengan ID folder Google Drive Anda
 * 5. Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy URL deployment, paste ke config.js
 */

// ============================================
// CONFIGURATION - GANTI DENGAN FOLDER ID ANDA
// ============================================
const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE';

// ============================================
// MAIN HANDLERS
// ============================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'upload':
        return jsonResponse(uploadFile(data));
      case 'delete':
        return jsonResponse(deleteFile(data.fileId));
      case 'getFile':
        return jsonResponse(getFileBase64(data.fileId));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getFile') {
      return jsonResponse(getFileBase64(e.parameter.fileId));
    }

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'Apps Script is running' });
    }

    return jsonResponse({ error: 'Missing or unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ============================================
// FILE OPERATIONS
// ============================================

/**
 * Upload file ke Google Drive
 * @param {Object} data - { fileData: base64, fileName: string, mimeType: string, folderName: string }
 * @returns {Object} { fileId, fileUrl, fileName }
 */
function uploadFile(data) {
  const rootFolder = DriveApp.getFolderById(FOLDER_ID);

  // Buat atau cari subfolder untuk siswa (berdasarkan NISN - Nama)
  let studentFolder;
  const folderName = data.folderName || 'Unknown';
  const folders = rootFolder.getFoldersByName(folderName);

  if (folders.hasNext()) {
    studentFolder = folders.next();
  } else {
    studentFolder = rootFolder.createFolder(folderName);
  }

  // Decode base64 dan buat file
  const blob = Utilities.newBlob(
    Utilities.base64Decode(data.fileData),
    data.mimeType,
    data.fileName
  );

  const file = studentFolder.createFile(blob);

  // Set file agar bisa diakses siapa saja yang punya link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    fileName: file.getName(),
    fileSize: file.getSize(),
    mimeType: file.getMimeType()
  };
}

/**
 * Hapus file dari Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Object} { success: boolean }
 */
function deleteFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'File not found: ' + err.message };
  }
}

/**
 * Ambil file sebagai base64 untuk preview
 * @param {string} fileId - Google Drive file ID
 * @returns {Object} { fileData: base64, mimeType: string, fileName: string }
 */
function getFileBase64(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());

    return {
      success: true,
      fileData: base64,
      mimeType: blob.getContentType(),
      fileName: file.getName(),
      fileSize: file.getSize()
    };
  } catch (err) {
    return { success: false, error: 'File not found: ' + err.message };
  }
}

// ============================================
// HELPER
// ============================================

function jsonResponse(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
