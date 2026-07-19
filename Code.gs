// Code.gs - Google Apps Script untuk Sistem Pengarsipan

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'upload') {
      const fileData = data.fileData; // base64 string
      const fileName = data.fileName; 
      const mimeType = data.mimeType || 'image/webp';
      
      const className = data.className || 'Tanpa Kelas';
      const studentName = data.studentName || 'Anonim';
      
      // Decode base64
      const decodedData = Utilities.base64Decode(fileData);
      const blob = Utilities.newBlob(decodedData, mimeType, fileName);
      
      // 1. Get or Create "Pengarsipan" Root Folder
      const rootFolderName = "Pengarsipan";
      let rootFolder;
      const rootFolders = DriveApp.getFoldersByName(rootFolderName);
      if (rootFolders.hasNext()) {
        rootFolder = rootFolders.next();
      } else {
        rootFolder = DriveApp.createFolder(rootFolderName);
      }
      
      // 2. Get or Create Class Folder (e.g. "7A")
      let classFolder;
      const classFolders = rootFolder.getFoldersByName(className);
      if (classFolders.hasNext()) {
        classFolder = classFolders.next();
      } else {
        classFolder = rootFolder.createFolder(className);
      }
      
      // 3. Get or Create Student Folder (e.g. "Budi Santoso")
      let studentFolder;
      const studentFolders = classFolder.getFoldersByName(studentName);
      if (studentFolders.hasNext()) {
        studentFolder = studentFolders.next();
      } else {
        studentFolder = classFolder.createFolder(studentName);
      }
      
      // 4. Create File in Student Folder
      const driveFile = studentFolder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: driveFile.getId(),
        fileUrl: driveFile.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (action === 'delete') {
      const fileId = data.fileId;
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
        } catch(err) {
          // ignore if file doesn't exist
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getFile') {
      const fileId = e.parameter.fileId;
      if (!fileId) throw new Error("Missing fileId");
      
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileData: base64,
        mimeType: blob.getContentType(),
        fileName: file.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
