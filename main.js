// Import Electron modules for creating desktop apps
import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// ES module compatibility: Get current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global reference to the main application window
let win;

/**
 * Creates the main application window with security settings
 * Sets up a secure renderer process with preload script for API access
 */
async function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    webPreferences: {
      // Load the preload script to expose safe APIs to the renderer
      preload: path.join(__dirname, 'preload.cjs'),
      // Enable context isolation for security (isolates main world from isolated world)
      contextIsolation: true,
      // Disable Node.js integration in renderer for security
      nodeIntegration: false,
      // Enable sandbox mode for additional security
      sandbox: true
    }
  });

  // Load the main HTML file into the window
  await win.loadFile('index.html');
}

// Initialize the app when Electron is ready
app.whenReady().then(() => {
  // Handle permission requests from renderer (e.g. getUserMedia)
  // We explicitly allow 'media' permissions so the camera/microphone prompt works in the renderer.
  // SECURITY: In a production app you may want to check `details.requestingUrl` and only allow
  // permissions for trusted origins. This example keeps it simple and allows media requests.
  try {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (permission === 'media') {
        // Allow camera/microphone access
        callback(true);
      } else {
        // Default deny for other permissions
        callback(false);
      }
    });
  } catch (err) {
    console.warn('Could not set permission request handler:', err);
  }

  createWindow();

  // macOS: Re-create window when app is activated (dock icon clicked) if no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  // On macOS, apps typically stay running even when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

/**
 * IPC Handler: Save session data as a .notepack folder
 * Creates a directory containing:
 * - notes.html: The rich text notes with timestamps
 * - media.webm: The recorded audio/video file
 * - session.json: Metadata about the session
 */
ipcMain.handle('save-session', async (evt, { noteHtml, mediaBuffer, mediaSuggestedExt = 'webm' }) => {
  // Show save dialog to user
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Notes + Recording',
    defaultPath: 'session.notepack',
    buttonLabel: 'Save Session',
    filters: [{ name: 'Note Pack', extensions: ['notepack'] }]
  });

  // Return early if user canceled
  if (canceled || !filePath) return { ok: false };

  // Ensure the path has .notepack extension
  const baseDir = filePath.endsWith('.notepack') ? filePath : filePath + '.notepack';

  // Create the directory structure
  await fs.mkdir(baseDir, { recursive: true });

  // Define file paths within the session directory
  const notesPath = path.join(baseDir, 'notes.html');
  const mediaPath = path.join(baseDir, `media.${mediaSuggestedExt}`);
  const metaPath  = path.join(baseDir, 'session.json');

  // Save the HTML notes content
  await fs.writeFile(notesPath, noteHtml ?? '', 'utf-8');

  // Save the media file if it exists
  if (mediaBuffer) {
    await fs.writeFile(mediaPath, Buffer.from(mediaBuffer));
  }

  // Create and save session metadata
  const meta = {
    createdAt: new Date().toISOString(),
    mediaFile: mediaBuffer ? path.basename(mediaPath) : null,
    notesFile: 'notes.html',
    version: 1
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return { ok: true, dir: baseDir };
});

/**
 * IPC Handler: Load a previously saved .notepack session
 * Reads the session directory and returns the notes and media content
 */
ipcMain.handle('load-session', async () => {
  // Show directory picker dialog
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open Session',
    properties: ['openDirectory']
  });

  // Return early if user canceled or no directory selected
  if (canceled || !filePaths?.[0]) return { ok: false };

  const baseDir = filePaths[0];
  const metaPath = path.join(baseDir, 'session.json');
  const notesPath = path.join(baseDir, 'notes.html');

  // Try to read the notes HTML file
  let notesHtml = '';
  try {
    notesHtml = await fs.readFile(notesPath, 'utf-8');
  } catch {
    // File might not exist, continue with empty notes
  }

  // Try to read session metadata to get media file name
  let mediaArrayBuffer = null;
  let mediaFile = 'media.webm'; // Default fallback
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw);
    if (meta?.mediaFile) mediaFile = meta.mediaFile;
  } catch {
    // Metadata file might not exist, use default
  }

  // Try to read the media file
  try {
    const mediaBuf = await fs.readFile(path.join(baseDir, mediaFile));
    // Convert Node.js Buffer to ArrayBuffer for renderer process
    mediaArrayBuffer = mediaBuf.buffer.slice(mediaBuf.byteOffset, mediaBuf.byteOffset + mediaBuf.byteLength);
  } catch {
    // Media file might not exist
  }

  return { ok: true, notesHtml, mediaArrayBuffer, mediaFileName: mediaFile };
});

/**
 * IPC Handler: Export session as a single self-contained HTML file
 * The HTML contains both notes and embedded media as base64 data
 * This creates a portable file that can be opened in any web browser
 */
ipcMain.handle('save-html', async (evt, { html }) => {
  // Show save dialog for HTML export
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Single HTML',
    defaultPath: 'session.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });

  // Return early if user canceled
  if (canceled || !filePath) return { ok: false };

  // Write the complete HTML content to file
  await fs.writeFile(filePath, html ?? '', 'utf-8');
  return { ok: true, path: filePath };
});

/**
 * IPC Handler: Export session as separate HTML and video files
 * Creates two files: HTML with notes and a separate video file
 * The HTML references the video file relatively for playback
 * Also saves any images as separate files if provided
 */
ipcMain.handle('save-html-video', async (evt, { html, mediaBuffer, mediaExt = 'webm', images = [] }) => {
  // Show save dialog for HTML export
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export HTML + Video',
    defaultPath: 'session.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });

  // Return early if user canceled
  if (canceled || !filePath) return { ok: false };

  // Determine paths for HTML and video files
  const baseName = path.basename(filePath, '.html');
  const baseDir = path.dirname(filePath);
  const htmlPath = filePath.endsWith('.html') ? filePath : filePath + '.html';

  // Create subfolders named after the HTML file for organization
  const mediaDir = path.join(baseDir, `${baseName}_media`);
  const imagesDir = path.join(baseDir, `${baseName}_images`);

  // Create directories if they don't exist
  await fs.mkdir(mediaDir, { recursive: true });
  if (images.length > 0) {
    await fs.mkdir(imagesDir, { recursive: true });
  }

  const videoFileName = `${baseName}.${mediaExt}`;
  const videoPath = path.join(mediaDir, videoFileName);
  const videoRelativePath = `${baseName}_media/${videoFileName}`;

  // Replace placeholders in HTML with actual paths
  let finalHtml = html.replace('__VIDEO_FILE__', videoRelativePath || '');
  finalHtml = finalHtml.replace(/__BASENAME___images/g, `${baseName}_images`);

  // Write the HTML content to file
  await fs.writeFile(htmlPath, finalHtml ?? '', 'utf-8');

  // Write the video file if media exists
  if (mediaBuffer) {
    await fs.writeFile(videoPath, Buffer.from(mediaBuffer));
  }

  // Write image files if any exist
  const savedImages = [];
  for (const image of images) {
    const imagePath = path.join(imagesDir, image.fileName);
    const imageBuffer = Buffer.from(image.base64Data, 'base64');
    await fs.writeFile(imagePath, imageBuffer);
    savedImages.push({ fileName: image.fileName, path: imagePath });
  }

  return {
    ok: true,
    htmlPath,
    videoPath: mediaBuffer ? videoPath : null,
    videoFileName: videoRelativePath,
    images: savedImages
  };
});

/**
 * IPC Handler: Pick an image file and convert it to a data URL
 * This allows images to be embedded directly in the notes editor
 * Returns the image as a base64-encoded data URL for immediate use
 */
ipcMain.handle('pick-image', async () => {
  // Show file picker for image selection
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg'] }]
  });

  // Return early if user canceled or no file selected
  if (canceled || !filePaths?.[0]) return { ok: false };

  const filePath = filePaths[0];

  // Read the image file as binary data
  const fileBuffer = await fs.readFile(filePath);

  // Determine MIME type based on file extension
  const extension = filePath.split('.').pop().toLowerCase();
  const mimeTypeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  const mimeType = mimeTypeMap[extension] || 'application/octet-stream';

  // Convert to base64 data URL for embedding in HTML
  const dataUrl = `data:${mimeType};base64,${Buffer.from(fileBuffer).toString('base64')}`;

  return { ok: true, dataUrl, mime: mimeType };
});
