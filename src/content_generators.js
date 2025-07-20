// Content generators for MCP server
// Contains functions for generating documentation and guidance content

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SUPPORTED_MIMETYPES } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load markdown content from file
 * @param {string} filename - Name of the markdown file (without .md extension)
 * @returns {string} - Markdown content
 */
function loadMarkdownContent(filename) {
  const markdownPath = path.join(__dirname, 'markdown', `${filename}.md`);
  try {
    return fs.readFileSync(markdownPath, 'utf8');
  } catch (error) {
    console.error(`Error loading markdown file ${filename}:`, error);
    return `# Error Loading Content\n\nCould not load content from ${filename}.md`;
  }
}

/**
 * Generate logo guidance resource content
 * @returns {string} - Markdown content for logo guidance
 */
export function generateLogoGuidanceResource() {
  return loadMarkdownContent('logo-guidance');
}

/**
 * Generate login button guidance resource content
 * @returns {string} - Markdown content for login button guidance
 */
export function generateLoginButtonGuidanceResource() {
  return loadMarkdownContent('login-button-guidance');
}

/**
 * Generate supported logo formats resource content
 * @returns {Object} - JSON object with supported formats information
 */
export function generateSupportedLogoFormatsResource() {
  return {
    supportedMimeTypes: SUPPORTED_MIMETYPES,
    supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.apng', '.svg'],
    recommendedFormat: 'PNG',
    maxFileSize: '100KB',
    notes: [
      'PNG format is recommended for transparency support',
      'SVG files are sanitized for security',
      'All images are scaled to fit within 400px × 100px',
      'Both light and dark theme versions are recommended',
      'Image data must include data URL prefix (e.g., data:image/png;base64,...)'
    ]
  };
} 