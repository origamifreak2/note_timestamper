// Import Electron modules for creating desktop apps
import { app, BrowserWindow, ipcMain, dialog, session, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';

// ES module compatibility: Get current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global reference to the main application window
let win;
// Track the last opened session directory (if user loaded a session)
let lastOpenedSessionDir = null;
// Global reference to the application menu (for dynamic state updates)
let appMenu = null;
// Temporary media write streams for streaming uploads from renderer
const tempMediaStreams = new Map();

// Map of session IDs to progress metadata for tracking save operations
const saveProgressMap = new Map();

/**
 * Helper: Report progress to renderer for a save operation
 * @param {BrowserWindow} win - The renderer window
 * @param {string} id - Session ID for tracking
 * @param {Object} progress - Progress object { phase, percent, bytesWritten, totalBytes, statusText }
 */
function reportSaveProgress(win, id, progress) {
  if (win && win.webContents) {
    win.webContents.send('save-progress', { id, ...progress });
  }
}

/**
 * Cleanup helper: Remove orphaned temporary media files from os.tmpdir()
 * Scans for files matching the notepack temp naming pattern and removes them
 * @returns {Promise<{ removed: number, failed: number }>}
 */
async function cleanupOrphanedTempFiles() {
  try {
    const os = await import('os');
    const tmpdir = os.tmpdir();
    const files = await fs.readdir(tmpdir);
    let removed = 0;
    let failed = 0;

    // Look for files matching notepack temp pattern: TIMESTAMP-RANDOM-*.ext
    // Pattern: /^\d+-[a-z0-9]+-.+$/
    for (const file of files) {
      if (/^\d+-[a-z0-9]+-/.test(file)) {
        const filePath = path.join(tmpdir, file);
        try {
          await fs.unlink(filePath);
          removed++;
          console.log(`Cleaned up temp file: ${file}`);
        } catch (err) {
          failed++;
          console.warn(`Failed to clean up ${file}:`, err.message);
        }
      }
    }

    return { removed, failed };
  } catch (err) {
    console.warn('Error during temp file cleanup:', err.message);
    return { removed: 0, failed: 0 };
  }
}

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

  // Create and set the application menu
  createApplicationMenu();
}

/**
 * Create and set the application menu with File menu items
 */
/**
 * Create and set the application menu with File menu items
 * Builds a complete menu template with File, Edit, View, Window (macOS), and Help menus
 */
function createApplicationMenu() {
  const template = [];

  // macOS: Add app menu (with app name) at the very top
  if (process.platform === 'darwin') {
    template.push({
      label: 'Note Timestamper',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  // File menu with custom Save/Load/Export actions
  template.push({
    label: 'File',
    submenu: [
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        id: 'menu-save',
        enabled: false,
        click: () => {
          if (win) win.webContents.send('menu-action', 'save');
        }
      },
      {
        label: 'Save As...',
        accelerator: 'Shift+CmdOrCtrl+S',
        id: 'menu-save-as',
        enabled: false,
        click: () => {
          if (win) win.webContents.send('menu-action', 'save-as');
        }
      },
      { type: 'separator' },
      {
        label: 'Load...',
        accelerator: 'CmdOrCtrl+O',
        id: 'menu-load',
        enabled: true,
        click: () => {
          if (win) win.webContents.send('menu-action', 'load');
        }
      },
      { type: 'separator' },
      {
        label: 'Export',
        id: 'menu-export',
        enabled: false,
        submenu: [
          {
            label: 'Export as HTML (embedded)',
            id: 'menu-export-embedded',
            enabled: false,
            click: () => {
              if (win) win.webContents.send('menu-action', 'export-embedded');
            }
          },
          {
            label: 'Export as HTML + Video',
            id: 'menu-export-separate',
            enabled: false,
            click: () => {
              if (win) win.webContents.send('menu-action', 'export-separate');
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Reset',
        accelerator: 'Shift+CmdOrCtrl+R',
        id: 'menu-reset',
        enabled: true,
        click: () => {
          if (win) win.webContents.send('menu-action', 'reset');
        }
      },
      { type: 'separator' },
      ...(process.platform === 'darwin' ? [] : [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ])
    ]
  });

  // Edit menu
  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(process.platform === 'darwin' ? [{ role: 'pasteAndMatchStyle' }] : []),
      { type: 'separator' },
      { role: 'selectAll' }
    ]
  });

  // View menu
  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  });

  // Window menu (macOS only)
  if (process.platform === 'darwin') {
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'windowMenu' }
      ]
    });
  }

  // Help menu
  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'About Note Timestamper',
        click: () => {
          // You can open an about dialog or window here if desired
        }
      }
    ]
  });

  appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

/**
 * Update menu item enabled state
 * Called from renderer process when UI state changes
 */
function updateMenuItemState(itemId, enabled) {
  if (!appMenu) return;
  const item = appMenu.getMenuItemById(itemId);
  if (item) {
    item.enabled = enabled;
  }
  // Refresh the menu to apply changes (required on macOS)
  Menu.setApplicationMenu(appMenu);
}

// Initialize the app when Electron is ready
app.whenReady().then(() => {
  // Clean up any orphaned temp files from previous crashes/sessions
  cleanupOrphanedTempFiles().then((result) => {
    if (result.removed > 0) {
      console.log(`Cleanup: removed ${result.removed} orphaned temp files`);
    }
  });

  // Handle permission requests from renderer (e.g. getUserMedia)
  // SECURITY: Only allow media permissions from our trusted local file origin
  try {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (permission === 'media') {
        // Validate that the request is coming from our app's file:// origin
        const requestingUrl = details.requestingUrl || '';
        const isLocalFile = requestingUrl.startsWith('file://');

        if (isLocalFile) {
          // Allow camera/microphone access from our app
          callback(true);
        } else {
          // Deny media access from untrusted origins
          console.warn(`Blocked media permission request from untrusted origin: ${requestingUrl}`);
          callback(false);
        }
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
ipcMain.handle('save-session', async (evt, payload) => {
  // Extract payload and normalize
  const { noteHtml, mediaBuffer, mediaFilePath, mediaSuggestedExt = 'webm', forceSaveAs = false, sessionId = null } = payload || {};

  let outPath = null;

  if (!forceSaveAs && lastOpenedSessionDir) {
    // Overwrite the previously opened session file without prompting
    outPath = lastOpenedSessionDir;
  } else {
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
    outPath = filePath.endsWith('.notepack') ? filePath : filePath + '.notepack';
    // Remember this as the last opened/saved session path
    lastOpenedSessionDir = outPath;
  }

  // Report initial progress
  if (sessionId && win) {
    reportSaveProgress(win, sessionId, {
      phase: 'creating-zip',
      percent: 5,
      statusText: 'Creating zip file...'
    });
  }

  // Create ZIP using yazl. Use dynamic import for better CJS/ESM interop.
  const yazlMod = (await import('yazl')).default || (await import('yazl'));
  const zipfile = new yazlMod.ZipFile();

  // Prepare buffers
  const notesBuf = Buffer.from(noteHtml ?? '', 'utf-8');

  // Add notes first
  zipfile.addBuffer(notesBuf, 'notes.html');

  // If a temp media file path was provided, stream it into the zip (no memory buffering)
  let mediaEntryName = null;
  if (mediaFilePath) {
    try {
      mediaEntryName = `media.${mediaSuggestedExt}`;
      // mediaFilePath is a filesystem path; use addFile to let yazl stream it
      zipfile.addFile(mediaFilePath, mediaEntryName);
    } catch (err) {
      // Fall back to no media if streaming fails
      console.warn('Failed to add media via file stream:', err);
      mediaEntryName = null;
    }
  } else if (mediaBuffer) {
    const mediaBuf = Buffer.from(mediaBuffer);
    mediaEntryName = `media.${mediaSuggestedExt}`;
    zipfile.addBuffer(mediaBuf, mediaEntryName);
  }

  const meta = {
    createdAt: new Date().toISOString(),
    mediaFile: mediaEntryName,
    notesFile: 'notes.html',
    version: 1
  };
  zipfile.addBuffer(Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'), 'session.json');

  // Write zip to disk and await completion
  return await new Promise((resolve) => {
    const outStream = fsSync.createWriteStream(outPath);
    let bytesWritten = 0;

    // Track write progress on the output stream
    outStream.on('drain', () => {
      // Estimate progress based on bytes flushed
      const progressPercent = Math.min(95, 10 + Math.round((bytesWritten / 5000000) * 80));
      if (sessionId && win) {
        reportSaveProgress(win, sessionId, {
          phase: 'writing-zip',
          percent: progressPercent,
          bytesWritten,
          statusText: `Writing zip (${(bytesWritten / 1024 / 1024).toFixed(1)}MB)`
        });
      }
    });

    // Track all data written to output stream
    const originalWrite = outStream.write.bind(outStream);
    outStream.write = function(chunk, ...args) {
      if (chunk && chunk.length) {
        bytesWritten += chunk.length;
      }
      return originalWrite(chunk, ...args);
    };

    zipfile.outputStream.pipe(outStream)
      .on('close', async () => {
        // Report completion before cleanup
        if (sessionId && win) {
          reportSaveProgress(win, sessionId, {
            phase: 'completed',
            percent: 100,
            statusText: 'Save complete'
          });
        }

        // If we used a temporary media file, try to remove it now
        try {
          if (mediaFilePath) {
            await fs.unlink(mediaFilePath).catch(() => {});
          }
        } catch (e) {
          // ignore cleanup errors
        }
        resolve({ ok: true, path: outPath });
      })
      .on('error', (err) => {
        resolve({ ok: false, error: err?.message || String(err) });
      });
    zipfile.end();
  });
});

/**
 * IPC: Create a temporary media file and open a writable stream.
 * Returns an id and the temp path to the renderer.
 */
ipcMain.handle('create-temp-media', async (evt, { fileName = null, sessionId = null } = {}) => {
  try {
    const os = await import('os');
    const tmpdir = os.tmpdir();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const safeName = fileName ? path.basename(fileName) : `media-${id}`;
    const tmpPath = path.join(tmpdir, `${id}-${safeName}`);
    const ws = fsSync.createWriteStream(tmpPath);

    // Initialize progress tracking for this stream
    const streamData = {
      ws,
      path: tmpPath,
      bytesWritten: 0,
      sessionId: sessionId || id
    };
    tempMediaStreams.set(id, streamData);

    // Track write progress
    ws.on('close', () => {
      // Cleanup tracking when stream closes
      saveProgressMap.delete(streamData.sessionId);
    });

    return { ok: true, id, path: tmpPath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

/**
 * IPC: Append a chunk (ArrayBuffer or Buffer) to a previously created temp media file
 * Tracks bytes written and reports progress
 */
ipcMain.handle('append-temp-media', async (evt, id, chunk, sessionId = null) => {
  try {
    const entry = tempMediaStreams.get(id);
    if (!entry) return { ok: false, error: 'Invalid temp id' };
    // chunk may arrive as a Uint8Array-like or Buffer; normalize
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    return await new Promise((resolve) => {
      entry.ws.write(buf, (err) => {
        if (!err) {
          entry.bytesWritten += buf.length;
          // Report progress back to renderer via the window that called us
          if (sessionId && win) {
            reportSaveProgress(win, sessionId, {
              phase: 'streaming-media',
              percent: Math.min(95, Math.round((entry.bytesWritten / 100000000) * 100)),
              bytesWritten: entry.bytesWritten,
              statusText: `Streaming media (${(entry.bytesWritten / 1024 / 1024).toFixed(1)}MB)`
            });
          }
        }
        if (err) return resolve({ ok: false, error: err.message });
        resolve({ ok: true, bytesWritten: entry.bytesWritten });
      });
    });
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

/**
 * IPC: Close the temp media writable stream and return the path
 */
ipcMain.handle('close-temp-media', async (evt, id) => {
  try {
    const entry = tempMediaStreams.get(id);
    if (!entry) return { ok: false, error: 'Invalid temp id' };
    await new Promise((resolve, reject) => {
      entry.ws.end(() => resolve());
      entry.ws.on('error', reject);
    });
    tempMediaStreams.delete(id);
    return { ok: true, path: entry.path };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

/**
 * IPC Handler: Load a previously saved .notepack session
 * Reads the session directory and returns the notes and media content
 */
ipcMain.handle('load-session', async () => {
  // Signal to renderer that loading has started
  if (win && win.webContents) {
    win.webContents.send('file-loading-start');
  }

  try {
    // Show file picker dialog for .notepack (zip) files
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open Session',
      properties: ['openFile'],
      filters: [{ name: 'Note Pack', extensions: ['notepack'] }]
    });

    if (canceled || !filePaths?.[0]) {
      if (win && win.webContents) {
        win.webContents.send('file-loading-complete');
      }
      return { ok: false };
    }

    const filePath = filePaths[0];
    lastOpenedSessionDir = filePath;

    // Use yauzl to read the zip file entries into memory
    const yauzlMod = (await import('yauzl')).default || (await import('yauzl'));

    return await new Promise((resolve) => {
      yauzlMod.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          if (win && win.webContents) {
            win.webContents.send('file-loading-complete');
          }
          return resolve({ ok: false, error: err?.message || 'Could not open notepack' });
        }

        const entries = {};

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          // Skip directory entries
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              if (win && win.webContents) {
                win.webContents.send('file-loading-complete');
              }
              return resolve({ ok: false, error: err.message });
            }

            const chunks = [];
            readStream.on('data', (c) => chunks.push(c));
            readStream.on('end', () => {
              entries[entry.fileName] = Buffer.concat(chunks);
              zipfile.readEntry();
            });
          });
        });

        zipfile.on('end', () => {
          // Signal to renderer that loading has completed
          if (win && win.webContents) {
            win.webContents.send('file-loading-complete');
          }

          // Build response from entries
          const notesHtml = entries['notes.html'] ? entries['notes.html'].toString('utf-8') : '';
          let mediaArrayBuffer = null;
          let mediaFileName = null;

          try {
            const metaBuf = entries['session.json'];
            let mediaFile = 'media.webm';
            if (metaBuf) {
              const meta = JSON.parse(metaBuf.toString('utf-8'));
              if (meta?.mediaFile) mediaFile = meta.mediaFile;
            }

            if (entries[mediaFile]) {
              const b = entries[mediaFile];
              mediaFileName = mediaFile;
              mediaArrayBuffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
            }
          } catch (e) {
            // ignore parse errors and continue
          }

          return resolve({ ok: true, notesHtml, mediaArrayBuffer, mediaFileName });
        });
      });
    });
  } catch (err) {
    if (win && win.webContents) {
      win.webContents.send('file-loading-complete');
    }
    return { ok: false, error: err?.message || String(err) };
  }
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
    svg: 'image/svg+xml',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  const mimeType = mimeTypeMap[extension] || 'application/octet-stream';

  // Convert to base64 data URL for embedding in HTML
  const dataUrl = `data:${mimeType};base64,${Buffer.from(fileBuffer).toString('base64')}`;

  return { ok: true, dataUrl, mime: mimeType };
});

/**
 * IPC Handler: Receive menu state updates from renderer
 * Renderer sends current enabled/disabled state for menu items
 */
ipcMain.on('menu-state', (evt, state) => {
  // Update File > Save
  updateMenuItemState('menu-save', state.canSave || false);
  updateMenuItemState('menu-save-as', state.canSaveAs || false);

  // Update File > Load
  updateMenuItemState('menu-load', state.canLoad !== false); // Load is almost always enabled

  // Update File > Export submenu
  updateMenuItemState('menu-export', state.canExport || false);
  updateMenuItemState('menu-export-embedded', state.canExport || false);
  updateMenuItemState('menu-export-separate', state.canExport || false);
  updateMenuItemState('menu-reset', state.canReset !== false);
});

// IPC Handler: Clear the stored last opened session directory
ipcMain.handle('clear-last-session', async () => {
  lastOpenedSessionDir = null;
  return { ok: true };
});
