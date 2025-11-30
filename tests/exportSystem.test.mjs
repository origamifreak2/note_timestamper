// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ExportSystem } from '../src/modules/exportSystem.js';

describe('exportSystem', () => {
  const exportSys = new ExportSystem();

  describe('stripFabricData', () => {
    it('removes data-fabric-json attribute', () => {
      const html = '<img src="data:image/png;base64,AAA" data-fabric-json=\'{"objects":[]}\' />';
      const cleaned = exportSys.stripFabricData(html);
      expect(cleaned).not.toContain('data-fabric-json');
    });

    it('removes editable-drawing class', () => {
      const html = '<img class="editable-drawing" src="test.png" data-fabric-json="{}" />';
      const cleaned = exportSys.stripFabricData(html);
      expect(cleaned).not.toContain('editable-drawing');
    });

    it('removes title and pointer cursor', () => {
      const html = '<img src="test.png" title="Double-click to edit" style="cursor: pointer;" data-fabric-json="{}" />';
      const cleaned = exportSys.stripFabricData(html);
      expect(cleaned).not.toContain('title=');
      expect(cleaned).not.toContain('cursor: pointer');
    });

    it('preserves non-drawing images', () => {
      const html = '<img src="regular.jpg" alt="A photo" />';
      const cleaned = exportSys.stripFabricData(html);
      expect(cleaned).toContain('src="regular.jpg"');
      expect(cleaned).toContain('alt="A photo"');
    });
  });

  describe('extractAndReplaceImages', () => {
    it('extracts base64 images and replaces with file references', () => {
      const html = '<p>Text <img src="data:image/png;base64,iVBORw0KGgo" /> more</p>';
      const { html: updated, images } = exportSys.extractAndReplaceImages(html, 'imgs');

      expect(updated).toContain('src="imgs/image_001.png"');
      expect(images).toHaveLength(1);
      expect(images[0].fileName).toBe('image_001.png');
      expect(images[0].base64Data).toBe('iVBORw0KGgo');
      expect(images[0].mimeType).toBe('image/png');
    });

    it('handles multiple images with sequential numbering', () => {
      const html = '<img src="data:image/jpeg;base64,AAA" /><img src="data:image/png;base64,BBB" />';
      const { html: updated, images } = exportSys.extractAndReplaceImages(html);

      expect(updated).toContain('src="images/image_001.jpg"');
      expect(updated).toContain('src="images/image_002.png"');
      expect(images).toHaveLength(2);
      expect(images[0].fileName).toBe('image_001.jpg');
      expect(images[1].fileName).toBe('image_002.png');
    });

    it('converts jpeg mime to jpg extension', () => {
      const html = '<img src="data:image/jpeg;base64,JPEG_DATA" />';
      const { images } = exportSys.extractAndReplaceImages(html);

      expect(images[0].fileName).toBe('image_001.jpg');
    });

    it('handles svg+xml mime type', () => {
      const html = '<img src="data:image/svg+xml;base64,SVG_DATA" />';
      const { images } = exportSys.extractAndReplaceImages(html);

      expect(images[0].fileName).toBe('image_001.svg');
      expect(images[0].mimeType).toBe('image/svg+xml');
    });

    it('preserves non-base64 images', () => {
      const html = '<img src="external.jpg" />';
      const { html: updated, images } = exportSys.extractAndReplaceImages(html);

      expect(updated).toContain('src="external.jpg"');
      expect(images).toHaveLength(0);
    });
  });

  describe('generateEmbeddedHTML', () => {
    it('includes base64 media and notes content', () => {
      const notesHtml = '<p>Test notes with <button class="ts" data-ts="12.34">00:12.34</button></p>';
      const mediaB64 = 'FAKE_BASE64_DATA';
      const mediaMime = 'video/webm';

      const html = exportSys.generateEmbeddedHTML(notesHtml, mediaB64, mediaMime);

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Test notes with');
      expect(html).toContain('FAKE_BASE64_DATA');
      expect(html).toContain('video/webm');
      expect(html).toContain('<video id="player" controls></video>');
    });

    it('includes shared styles and utilities', () => {
      const html = exportSys.generateEmbeddedHTML('<p>x</p>', '', 'video/webm');

      expect(html).toContain('font-family: system-ui');
      expect(html).toContain('function fmtTime(s)');
      expect(html).toContain('const player=document.getElementById');
    });

    it('escapes closing script tags in notes', () => {
      const notesHtml = '<p>Code: <script>alert("test")</script></p>';
      const html = exportSys.generateEmbeddedHTML(notesHtml, '', 'video/webm');

      // Should escape closing script tag to prevent breaking the outer script
      expect(html).toContain('<\\/script>');
      // The opening tag is preserved, only closing tag is escaped
      expect(html).toContain('<p>Code: <script>alert');
    });
  });

  describe('generateSeparateHTML', () => {
    it('uses __VIDEO_FILE__ placeholder for external media', () => {
      const notesHtml = '<p>Notes content</p>';
      const html = exportSys.generateSeparateHTML(notesHtml);

      expect(html).toContain('__VIDEO_FILE__');
      expect(html).toContain('Notes content');
      expect(html).not.toContain('b64ToUint8'); // Should not have embedded conversion
    });

    it('includes image modal structure', () => {
      const html = exportSys.generateSeparateHTML('<p>x</p>');

      expect(html).toContain('id="imageModal"');
      expect(html).toContain('class="image-modal"');
      expect(html).toContain('<span class="close">');
    });
  });

  describe('getSharedStyles', () => {
    it('includes video and timestamp button styles', () => {
      const styles = exportSys.getSharedStyles();

      expect(styles).toContain('video, audio');
      expect(styles).toContain('.ts {');
      expect(styles).toContain('border-radius');
    });

    it('includes responsive grid styles', () => {
      const styles = exportSys.getSharedStyles();

      expect(styles).toContain('.grid {');
      expect(styles).toContain('@media (max-width: 900px)');
    });

    it('includes image modal styles', () => {
      const styles = exportSys.getSharedStyles();

      expect(styles).toContain('.image-modal');
      expect(styles).toContain('z-index: 1000');
    });
  });

  describe('buildHTMLTemplate', () => {
    it('combines all components into complete document', () => {
      const notesHtml = '<p>Notes</p>';
      const mediaScript = 'console.log("media");';

      const html = exportSys.buildHTMLTemplate(notesHtml, mediaScript);

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<title>Notes + Recording</title>');
      expect(html).toContain('<p>Notes</p>');
      expect(html).toContain('console.log("media");');
      expect(html).toContain('function fmtTime(s)');
    });

    it('includes image modal click handler', () => {
      const html = exportSys.buildHTMLTemplate('<p>x</p>', '');

      expect(html).toContain('const img = e.target.closest(\'img\')');
      expect(html).toContain('modal.style.display = \'block\'');
    });
  });
});
