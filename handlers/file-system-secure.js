// Secure File System Handler
// Prevents directory traversal, validates paths, sanitizes inputs

const path = require('path');
const fs = require('fs').promises;
const { shell } = require('electron');
const crypto = require('crypto');

class SecureFileSystemHandler {
    constructor() {
        // Define allowed base directories
        this.allowedBasePaths = [
            path.join(process.env.HOME || process.env.USERPROFILE, 'Music'),
            path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop'),
            path.join(process.env.HOME || process.env.USERPROFILE, 'Documents'),
            '/Volumes', // For external drives on macOS
            'C:\\',
            'D:\\',
            'E:\\' // For Windows drives
        ];

        // File extension whitelist for audio files
        this.allowedExtensions = [
            '.mp3',
            '.m4a',
            '.wav',
            '.flac',
            '.ogg',
            '.aac',
            '.wma',
            '.aiff',
            '.ape',
            '.opus'
        ];
    }

    // Validate that a path is safe to access
    validatePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }

        // Normalize the path to prevent traversal attacks
        const normalizedPath = path.normalize(filePath);
        const resolvedPath = path.resolve(normalizedPath);

        // Check for directory traversal attempts
        if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
            throw new Error('Directory traversal detected');
        }

        // Ensure the path is absolute
        if (!path.isAbsolute(resolvedPath)) {
            throw new Error('Path must be absolute');
        }

        // Check if path is within allowed directories
        const isAllowed = this.allowedBasePaths.some(basePath => {
            return resolvedPath.startsWith(path.normalize(basePath));
        });

        if (!isAllowed) {
            throw new Error('Access to this directory is not allowed');
        }

        return resolvedPath;
    }

    // Validate file extension
    validateFileExtension(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
            throw new Error(`File type ${ext} is not allowed`);
        }
        return true;
    }

    // Secure file exists check
    async fileExists(filePath) {
        try {
            const validPath = this.validatePath(filePath);
            const stats = await fs.stat(validPath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    // Secure file read with size limit
    async readFile(filePath, options = {}) {
        const validPath = this.validatePath(filePath);
        this.validateFileExtension(validPath);

        // Check file size (limit to 500MB for audio files)
        const stats = await fs.stat(validPath);
        const maxSize = options.maxSize || 500 * 1024 * 1024; // 500MB

        if (stats.size > maxSize) {
            throw new Error('File size exceeds maximum allowed');
        }

        return fs.readFile(validPath, options.encoding || null);
    }

    // Secure directory listing
    async listDirectory(dirPath, options = {}) {
        const validPath = this.validatePath(dirPath);

        const files = await fs.readdir(validPath, { withFileTypes: true });

        // Filter only audio files
        const audioFiles = files.filter(file => {
            if (!file.isFile()) {
                return false;
            }
            const ext = path.extname(file.name).toLowerCase();
            return this.allowedExtensions.includes(ext);
        });

        // Limit results
        const limit = Math.min(options.limit || 1000, 5000);
        const limited = audioFiles.slice(0, limit);

        // Return safe file info
        return limited.map(file => ({
            name: file.name,
            path: path.join(validPath, file.name),
            extension: path.extname(file.name).toLowerCase()
        }));
    }

    // Secure show in folder
    async showInFolder(filePath) {
        try {
            const validPath = this.validatePath(filePath);

            // Verify file exists
            if (!(await this.fileExists(validPath))) {
                throw new Error('File not found');
            }

            // Use electron's shell safely
            shell.showItemInFolder(validPath);

            return { success: true };
        } catch (error) {
            console.error('Show in folder error:', error.message);
            return {
                success: false,
                error: 'Cannot show file in folder'
            };
        }
    }

    // Generate secure file hash
    async getFileHash(filePath) {
        const validPath = this.validatePath(filePath);
        this.validateFileExtension(validPath);

        const fileBuffer = await fs.readFile(validPath);
        const hash = crypto.createHash('sha256');
        hash.update(fileBuffer);

        return hash.digest('hex');
    }

    // Secure file metadata extraction
    async getFileMetadata(filePath) {
        const validPath = this.validatePath(filePath);
        this.validateFileExtension(validPath);

        const stats = await fs.stat(validPath);

        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isFile: stats.isFile(),
            extension: path.extname(validPath),
            name: path.basename(validPath),
            directory: path.dirname(validPath)
        };
    }

    // Create secure file handlers for IPC
    createHandlers() {
        return {
            'show-in-folder': async (event, filePath) => {
                return this.showInFolder(filePath);
            },

            'check-file-exists': async (event, filePath) => {
                try {
                    return { exists: await this.fileExists(filePath) };
                } catch {
                    return { exists: false };
                }
            },

            'get-file-metadata': async (event, filePath) => {
                try {
                    const metadata = await this.getFileMetadata(filePath);
                    return { success: true, metadata };
                } catch (error) {
                    return {
                        success: false,
                        error: 'Cannot read file metadata'
                    };
                }
            },

            'list-audio-files': async (event, dirPath) => {
                try {
                    const files = await this.listDirectory(dirPath);
                    return { success: true, files };
                } catch (error) {
                    return {
                        success: false,
                        error: 'Cannot list directory',
                        files: []
                    };
                }
            }
        };
    }
}

module.exports = new SecureFileSystemHandler();
