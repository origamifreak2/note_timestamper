/**
 * @fileoverview Export functionality for sessions
 * Handles exporting sessions as HTML files with embedded or separate media
 */

import { arrayBufferToBase64 } from '../modules/utils.js';
import { errorBoundary } from '../modules/errorBoundary.js';

/**
 * Export system for converting sessions to HTML formats
 */
export class ExportSystem {
  constructor() {
    this.recordingSystem = null;
    this.quill = null;
  }

  /**
   * Initialize export system with dependencies
   * @param {Object} recordingSystem - Recording system instance
   * @param {Quill} quill - Quill editor instance
   */
  init(recordingSystem, quill) {
    this.recordingSystem = recordingSystem;
    this.quill = quill;
  }

  /**
   * Remove fabric JSON data and editable-drawing attributes from HTML
   * This cleans up the export to remove internal editing metadata
   * @param {string} html - HTML content to clean
   * @returns {string} Cleaned HTML without fabric data
   */
  stripFabricData(html) {
    // Create a temporary DOM to safely manipulate HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Find all images with fabric data and clean them
    const editableImages = tempDiv.querySelectorAll('img[data-fabric-json]');
    editableImages.forEach(img => {
      img.removeAttribute('data-fabric-json');
      img.classList.remove('editable-drawing');
      img.removeAttribute('title');
      // Reset cursor style
      if (img.style.cursor === 'pointer') {
        img.style.cursor = '';
      }
    });

    return tempDiv.innerHTML;
  }

  /**
   * Export session as embedded HTML (single file with base64-encoded media)
   * @returns {Promise<Object>} Result from main process
   */
  async exportAsEmbeddedHtml() {
    const notesHtml = this.stripFabricData(this.quill.root.innerHTML);
    let mediaMime = 'video/webm';
    let mediaB64 = '';

    const recordedBlob = this.recordingSystem.getRecordedBlob();
    if (recordedBlob) {
      const ab = await recordedBlob.arrayBuffer();
      mediaB64 = arrayBufferToBase64(ab);
      mediaMime = recordedBlob.type || 'video/webm';
    }

    const html = this.generateEmbeddedHTML(notesHtml, mediaB64, mediaMime);
    // Note: Don't wrap with timeout - it includes file picker dialog
    // where user needs unlimited time to choose save location
    return await window.api.saveHtml({ html });
  }

  /**
   * Export session as separate HTML + video files
   * @returns {Promise<Object>} Result from main process
   */
  async exportAsSeparateFiles() {
    const notesHtml = this.stripFabricData(this.quill.root.innerHTML);
    let mediaBuffer = null;

    const recordedBlob = this.recordingSystem.getRecordedBlob();
    if (recordedBlob) {
      mediaBuffer = await recordedBlob.arrayBuffer();
    }

    // The backend will handle the folder naming based on the chosen filename
    // We need to use a placeholder that the backend will replace with the actual folder name
    const { html, images } = this.extractAndReplaceImages(notesHtml, '__BASENAME___images');
    const finalHtml = this.generateSeparateHTML(html);

    // Note: Don't wrap with timeout - it includes file picker dialog
    // where user needs unlimited time to choose save location
    return await window.api.saveHtmlVideo({
      html: finalHtml,
      mediaBuffer,
      mediaExt: this.recordingSystem.getMediaExtension(),
      images
    });
  }

  /**
   * Extract base64 images from HTML and replace with file references
   * @param {string} html - HTML content containing base64 images
   * @param {string} folderPrefix - Folder prefix to use (defaults to 'images')
   * @returns {Object} Object containing updated HTML and extracted images array
   */
  extractAndReplaceImages(html, folderPrefix = 'images') {
    const images = [];
    let imageCounter = 1;

    // Replace base64 data URLs with file references
    const updatedHtml = html.replace(/src="data:image\/([^;]+);base64,([^"]+)"/g, (match, mimeExtension, base64Data) => {
      // Convert MIME type to file extension
      let fileExtension = mimeExtension;
      if (mimeExtension === 'jpeg') {
        fileExtension = 'jpg';
      }

      const imageFileName = `image_${imageCounter.toString().padStart(3, '0')}.${fileExtension}`;

      // Store image data for saving
      images.push({
        fileName: imageFileName,
        base64Data: base64Data,
        mimeType: `image/${mimeExtension}`
      });

      imageCounter++;

      // Replace with relative file reference pointing to images subfolder
      return `src="${folderPrefix}/${imageFileName}"`;
    });

    return { html: updatedHtml, images };
  }

  /**
   * Generate HTML template for embedded export
   * @param {string} notesHtml - HTML content from editor
   * @param {string} mediaB64 - Base64-encoded media data
   * @param {string} mediaMime - Media MIME type
   * @returns {string} Complete HTML document
   */
  generateEmbeddedHTML(notesHtml, mediaB64, mediaMime) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Notes + Recording</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 16px; }
  video, audio { max-width: 100%; border-radius: 8px; background: #000; }
  .ts { padding: .1rem .35rem; border-radius: 6px; border: 1px solid #999; background: #f7f7f7; cursor: pointer; }
  .ts:focus { outline: 2px solid #a3d3ff; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

  /* Image modal styles */
  #notes img { cursor: pointer; transition: opacity 0.2s; }
  #notes img:hover { opacity: 0.8; }
  .image-modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    cursor: pointer;
  }
  .image-modal img {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 95%;
    max-height: 95%;
    border-radius: 8px;
    cursor: auto;
  }
  .image-modal .close {
    position: absolute;
    top: 20px;
    right: 35px;
    color: #fff;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
  }
  .image-modal .close:hover {
    opacity: 0.7;
  }
</style>
</head>
<body>
  <div class="grid">
    <section>
      <h2>Playback</h2>
      <video id="player" controls></video>
      <div>Current: <span id="tNow">00:00.00</span></div>
    </section>
    <section>
      <h2>Notes</h2>
      <div id="notes">${notesHtml.replace(/<\/script>/gi, '<\\/script>')}</div>
    </section>
  </div>

  <!-- Image modal -->
  <div id="imageModal" class="image-modal">
    <span class="close">&times;</span>
    <img id="modalImage" src="" alt="Enlarged image">
  </div>
<script>
  function b64ToUint8(b64){ const bin=atob(b64), len=bin.length, bytes=new Uint8Array(len); for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i); return bytes; }
  function fmtTime(s){ const ms=Math.floor((s%1)*100); s=Math.floor(s); const m=Math.floor(s/60); const sec=s%60; const pad=n=>String(n).padStart(2,'0'); return \`\${pad(m)}:\${pad(sec)}.\${pad(ms)}\`; }
  const player=document.getElementById('player'); const tNow=document.getElementById('tNow');
  const _MEDIA_MIME = '${mediaMime}';
  const _MEDIA_B64  = '${mediaB64}';
  if(_MEDIA_B64){
    const url = URL.createObjectURL(new Blob([b64ToUint8(_MEDIA_B64)], { type: _MEDIA_MIME }));
    player.src = url;
  } else {
    player.replaceWith(document.createTextNode('No media in this export.'));
  }
  document.getElementById('notes').addEventListener('click', (e)=>{
    const btn = e.target.closest('button.ts');
    if(btn) {
      const ts = Number(btn.dataset.ts||'0');
      if(Number.isFinite(ts)) {
        player.currentTime = ts;
        player.play();
      }
      return;
    }

    // Handle image clicks for modal
    const img = e.target.closest('img');
    if(img) {
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      modal.style.display = 'block';
      modalImg.src = img.src;
    }
  });

  // Image modal functionality
  const modal = document.getElementById('imageModal');
  const closeBtn = modal.querySelector('.close');

  // Close modal when clicking close button or background
  closeBtn.onclick = () => modal.style.display = 'none';
  modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };

  // Close modal with ESC key
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') modal.style.display = 'none'; });

  if (player) { player.addEventListener('timeupdate', ()=>{ tNow.textContent = fmtTime(player.currentTime || 0); }); }
</script>
</body>
</html>`;
  }

  /**
   * Generate HTML template for separate files export
   * @param {string} notesHtml - HTML content from editor
   * @returns {string} Complete HTML document
   */
  generateSeparateHTML(notesHtml) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Notes + Recording</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 16px; }
  video, audio { max-width: 100%; border-radius: 8px; background: #000; }
  .ts { padding: .1rem .35rem; border-radius: 6px; border: 1px solid #999; background: #f7f7f7; cursor: pointer; }
  .ts:focus { outline: 2px solid #a3d3ff; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

  /* Image modal styles */
  #notes img { cursor: pointer; transition: opacity 0.2s; }
  #notes img:hover { opacity: 0.8; }
  .image-modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    cursor: pointer;
  }
  .image-modal img {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 95%;
    max-height: 95%;
    border-radius: 8px;
    cursor: auto;
  }
  .image-modal .close {
    position: absolute;
    top: 20px;
    right: 35px;
    color: #fff;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
  }
  .image-modal .close:hover {
    opacity: 0.7;
  }
</style>
</head>
<body>
  <div class="grid">
    <section>
      <h2>Playback</h2>
      <video id="player" controls></video>
      <div>Current: <span id="tNow">00:00.00</span></div>
    </section>
    <section>
      <h2>Notes</h2>
      <div id="notes">${notesHtml.replace(/<\/script>/gi, '<\\/script>')}</div>
    </section>
  </div>

  <!-- Image modal -->
  <div id="imageModal" class="image-modal">
    <span class="close">&times;</span>
    <img id="modalImage" src="" alt="Enlarged image">
  </div>
<script>
  function fmtTime(s){ const ms=Math.floor((s%1)*100); s=Math.floor(s); const m=Math.floor(s/60); const sec=s%60; const pad=n=>String(n).padStart(2,'0'); return \`\${pad(m)}:\${pad(sec)}.\${pad(ms)}\`; }
  const player=document.getElementById('player'); const tNow=document.getElementById('tNow');

  // Set video source to external file
  const videoFileName = '__VIDEO_FILE__';
  if(videoFileName && videoFileName !== '__VIDEO_FILE__'){
    player.src = videoFileName;
  } else {
    player.replaceWith(document.createTextNode('No media file found. Make sure the media folders are in the same directory as this HTML file.'));
  }

  document.getElementById('notes').addEventListener('click', (e)=>{
    const btn = e.target.closest('button.ts');
    if(btn) {
      const ts = Number(btn.dataset.ts||'0');
      if(Number.isFinite(ts)) {
        player.currentTime = ts;
        player.play();
      }
      return;
    }

    // Handle image clicks for modal
    const img = e.target.closest('img');
    if(img) {
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      modal.style.display = 'block';
      modalImg.src = img.src;
    }
  });

  // Image modal functionality
  const modal = document.getElementById('imageModal');
  const closeBtn = modal.querySelector('.close');

  // Close modal when clicking close button or background
  closeBtn.onclick = () => modal.style.display = 'none';
  modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };

  // Close modal with ESC key
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') modal.style.display = 'none'; });

  if (player) { player.addEventListener('timeupdate', ()=>{ tNow.textContent = fmtTime(player.currentTime || 0); }); }
</script>
</body>
</html>`;
  }
}

// Create a singleton instance
export const exportSystem = new ExportSystem();