
/**
 * @fileoverview Camera capture functionality
 * Handles capturing photos from device camera while recording
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - async capturePhotoFromCamera(): Promise<string|null>
 *       Opens camera modal, captures photo, inserts into editor.
 *   - createCameraModal(): HTMLElement
 *       Creates modal overlay for camera interface.
 *   - async loadAvailableCameras(): Promise<void>
 *       Loads available camera devices for selection.
 *   - async switchCamera(videoElement: HTMLVideoElement, cameraId: string): Promise<void>
 *       Switches video element to selected camera device.
 *   - cleanupWithVideoElement(videoElement: HTMLVideoElement, cameraModal: HTMLElement): void
 *       Cleans up video element and modal after capture.
 *   - cleanup(cameraStream: MediaStream, cameraModal: HTMLElement): void
 *       Cleans up camera stream and modal resources.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

import { imageManager } from '../editor/imageManager.js';
import { deviceManager } from '../modules/deviceManager.js';

/**
 * Camera capture system for taking photos during recording
 */
export class CameraSystem {
  constructor() {
    this.isModalOpen = false;
    this.availableCameras = [];
    this.selectedCameraId = null;
  }

  /**
   * Opens device camera to take a photo and insert it into the editor
   * Uses a separate MediaStream from the recording to avoid interference
   * Creates a modal overlay with video preview and capture button
   */
  async capturePhotoFromCamera() {
    if (this.isModalOpen) return null;

    this.isModalOpen = true;
    let cameraStream = null;
    let cameraModal = null;

    try {
      // Get available cameras first
      await this.loadAvailableCameras();

      // Create modal overlay for camera interface first
      cameraModal = this.createCameraModal();
      document.body.appendChild(cameraModal);

      // Get video element and canvas from modal
      const videoElement = cameraModal.querySelector('#cameraVideo');
      const canvas = cameraModal.querySelector('#cameraCanvas');
      const ctx = canvas.getContext('2d');
      const captureBtn = cameraModal.querySelector('#captureBtn');
      const cancelBtn = cameraModal.querySelector('#cancelBtn');
      const cameraSelect = cameraModal.querySelector('#modalCameraSelect');

      // Set up camera selection handler
      cameraSelect.addEventListener('change', async () => {
        const selectedCameraId = cameraSelect.value;
        if (selectedCameraId !== 'default') {
          this.selectedCameraId = selectedCameraId;
          // Switch to selected camera
          await this.switchCamera(videoElement, selectedCameraId);
        }
      });

      // Get initial camera stream (use the currently selected camera from main UI)
      const initialCameraId = deviceManager.getSelectedCamId();
      this.selectedCameraId = initialCameraId;

      // Set the dropdown to match the main UI selection
      if (initialCameraId) {
        cameraSelect.value = initialCameraId;
      }

      const videoConstraints = initialCameraId ?
        { deviceId: { exact: initialCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } } :
        { width: { ideal: 1280 }, height: { ideal: 720 } };

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      videoElement.srcObject = cameraStream;
      await videoElement.play();

      // Set canvas dimensions to match video
      videoElement.addEventListener('loadedmetadata', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
        const maxWidth = Math.min(window.innerWidth * 0.8, 640);
        const calculatedHeight = maxWidth / aspectRatio;

        videoElement.style.width = `${maxWidth}px`;
        videoElement.style.height = `${calculatedHeight}px`;
      });

      // Return a Promise that resolves when photo is taken or cancelled
      return new Promise((resolve) => {
        // Capture button handler
        captureBtn.addEventListener('click', () => {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          this.cleanupWithVideoElement(videoElement, cameraModal);
          resolve(dataUrl);
        });

        // Cancel button handler
        cancelBtn.addEventListener('click', () => {
          this.cleanupWithVideoElement(videoElement, cameraModal);
          resolve(null);
        });
      });

    } catch (error) {
      console.error('Camera access failed:', error);
      this.cleanup(cameraStream, cameraModal);

      let errorMessage = 'Camera access failed. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera device found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += 'Please check permissions and try again.';
      }

      alert(errorMessage);
      return null;
    } finally {
      // Ensure modal is marked as closed to allow reopening
      this.isModalOpen = false;

      // Ensure cleanup runs if modal is still in DOM (error before button click)
      if (cameraModal && cameraModal.parentNode) {
        this.cleanup(cameraStream, cameraModal);
      }
    }
  }

  /**
   * Creates the modal overlay interface for camera capture
   */
  createCameraModal() {
    const modal = document.createElement('div');
    modal.className = 'camera-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, sans-serif;
    `;

    // Build camera options HTML
    let cameraOptionsHtml = '<option value="default">System Default</option>';
    this.availableCameras.forEach(camera => {
      const label = camera.label || `Camera (${camera.deviceId.slice(0, 6)}…)`;
      cameraOptionsHtml += `<option value="${camera.deviceId}">${label}</option>`;
    });

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      ">
        <h3 style="margin: 0; color: #333; font-size: 18px;">Take Photo</h3>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <label style="font-size: 14px; font-weight: 500; color: #374151;">
            <i class="fa-solid fa-video"></i> Camera:
          </label>
          <select id="modalCameraSelect" style="
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: white;
            font-size: 14px;
            min-width: 200px;
          ">
            ${cameraOptionsHtml}
          </select>
        </div>

        <div style="position: relative; display: flex; justify-content: center;">
          <video id="cameraVideo"
                 style="
                   max-width: min(80vw, 640px);
                   width: 100%;
                   height: auto;
                   border-radius: 4px;
                   background: #000;
                 "
                 muted playsinline>
          </video>
          <canvas id="cameraCanvas" style="display: none;"></canvas>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="captureBtn" style="
            padding: 10px 20px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            <i class="fa-solid fa-camera"></i> Capture Photo
          </button>
          <button id="cancelBtn" style="
            padding: 10px 20px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            <i class="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    `;

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const cancelBtn = modal.querySelector('#cancelBtn');
        cancelBtn.click();
      }
    });

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        const cancelBtn = modal.querySelector('#cancelBtn');
        cancelBtn.click();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    return modal;
  }

  /**
   * Load available camera devices
   */
  async loadAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Failed to enumerate cameras:', error);
      this.availableCameras = [];
    }
  }

  /**
   * Switch to a different camera
   */
  async switchCamera(videoElement, cameraId) {
    try {
      // Stop current stream
      if (videoElement.srcObject) {
        const currentStream = videoElement.srcObject;
        currentStream.getTracks().forEach(track => track.stop());
      }

      // Get new camera stream
      const constraints = cameraId && cameraId !== 'default' ?
        { video: { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } } } :
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = newStream;
      await videoElement.play();

      this.selectedCameraId = cameraId;
    } catch (error) {
      console.error('Failed to switch camera:', error);
      alert('Failed to switch camera: ' + error.message);
    }
  }

  /**
   * Clean up camera resources using video element
   */
  cleanupWithVideoElement(videoElement, cameraModal) {
    // Stop all tracks from the current video stream
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }

    if (cameraModal && cameraModal.parentNode) {
      cameraModal.parentNode.removeChild(cameraModal);
    }
    this.isModalOpen = false;
  }

  /**
   * Clean up camera resources
   */
  cleanup(cameraStream, cameraModal) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    if (cameraModal && cameraModal.parentNode) {
      cameraModal.parentNode.removeChild(cameraModal);
    }
    this.isModalOpen = false;
  }
}

// Create a singleton instance
export const cameraSystem = new CameraSystem();