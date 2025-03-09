// Main application code
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const githubUrlInput = document.getElementById('github-url');
    const downloadBtn = document.getElementById('download-btn');
    const zipUploadInput = document.getElementById('zip-upload');
    const statusSection = document.getElementById('status-section');
    const statusMessage = document.getElementById('status-message');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const fileTreeSection = document.getElementById('file-tree-section');
    const fileTree = document.getElementById('file-tree');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const invertSelectionBtn = document.getElementById('invert-selection-btn');
    const generateBtn = document.getElementById('generate-btn');
    const resultSection = document.getElementById('result-section');
    const resultDisplay = document.getElementById('result-display');
    const tokenEstimate = document.getElementById('token-estimate');
    const copyBtn = document.getElementById('copy-btn');
    const downloadTextBtn = document.getElementById('download-text-btn');
    const editorModal = document.getElementById('editor-modal');
    const editorFileName = document.getElementById('editor-file-name');
    const closeModalBtn = document.querySelector('.close-modal');
    const monacoEditorContainer = document.getElementById('monaco-editor-container');
    
    // Variables
    let repoFiles = [];
    let repoStructure = {};
    let resultText = '';
    let monacoEditor = null;
    let monacoEditorLoaded = false;
    
    // Event listeners
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleGithubDownload);
    }
    
    if (zipUploadInput) {
        zipUploadInput.addEventListener('change', handleZipUpload);
    }
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => toggleAllFiles(true));
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => toggleAllFiles(false));
    }
    
    if (invertSelectionBtn) {
        invertSelectionBtn.addEventListener('click', invertSelection);
    }
    
    if (generateBtn) {
        generateBtn.addEventListener('click', generateText);
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }
    
    if (downloadTextBtn) {
        downloadTextBtn.addEventListener('click', downloadAsText);
    }

    // GitHub URL handling
    async function handleGithubDownload() {
        const url = githubUrlInput.value.trim();
        if (!url) {
            alert('Please enter a GitHub repository URL');
            return;
        }

        try {
            // Show status section
            statusSection.classList.remove('hidden');
            progressContainer.classList.remove('hidden');
            updateStatus('Preparing to download repository...', 0);

            // Parse GitHub URL to get the download link
            const zipUrl = getGitHubZipUrl(url);
            if (!zipUrl) {
                throw new Error('Invalid GitHub repository URL');
            }

            // Download the ZIP file
            const zipData = await downloadZipFile(zipUrl);
            
            // Process the ZIP file
            await processZipData(zipData);
            
        } catch (error) {
            updateStatus(`Error: ${error.message}`, 0);
            console.error('Download error:', error);
        }
    }

    // Handle ZIP file upload
    async function handleZipUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Show status section
            statusSection.classList.remove('hidden');
            progressContainer.classList.remove('hidden');
            updateStatus(`Processing uploaded file: ${file.name}`, 0);
            
            // Read the file as an ArrayBuffer
            const arrayBuffer = await readFileAsArrayBuffer(file);
            
            // Convert ArrayBuffer to Uint8Array
            const zipData = new Uint8Array(arrayBuffer);
            
            // Process the ZIP file
            await processZipData(zipData);
            
        } catch (error) {
            updateStatus(`Error: ${error.message}`, 0);
            console.error('Upload error:', error);
        }
    }
    
    // Read file as ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (error) => {
                reject(error);
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    // Parse GitHub URL and convert to ZIP download URL
    function getGitHubZipUrl(url) {
        try {
            const githubRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(\/tree\/([^\/]+))?/;
            const match = url.match(githubRegex);
            
            if (!match) return null;
            
            const [, owner, repo, , branch = 'master'] = match;
            return `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
        } catch (error) {
            console.error('Error parsing GitHub URL:', error);
            return null;
        }
    }

    // Download ZIP file with progress tracking
    async function downloadZipFile(url) {
        try {
            updateStatus('Downloading repository ZIP file...', 10);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            }
            
            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;
            
            const reader = response.body.getReader();
            const chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                if (total) {
                    const progress = Math.round((loaded / total) * 100);
                    updateStatus(
                        `Downloading: ${formatBytes(loaded)} of ${formatBytes(total)} (${formatSpeed(loaded)})`, 
                        progress
                    );
                } else {
                    updateStatus(`Downloading: ${formatBytes(loaded)} (${formatSpeed(loaded)})`, 30);
                }
            }
            
            updateStatus('Download complete. Processing ZIP file...', 50);
            
            // Combine chunks into a single Uint8Array
            const chunksAll = new Uint8Array(loaded);
            let position = 0;
            for (const chunk of chunks) {
                chunksAll.set(chunk, position);
                position += chunk.length;
            }
            
            return chunksAll;
        } catch (error) {
            console.error('Error downloading ZIP:', error);
            throw new Error(`Failed to download repository: ${error.message}`);
        }
    }

    // Format bytes to human-readable format
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Calculate and format download speed
    let lastLoaded = 0;
    let lastTime = Date.now();
    
    function formatSpeed(loaded) {
        const now = Date.now();
        const timeElapsed = (now - lastTime) / 1000; // in seconds
        
        if (timeElapsed < 0.1) return '...'; // Not enough time has passed
        
        const loadedDiff = loaded - lastLoaded;
        const speed = loadedDiff / timeElapsed; // bytes per second
        
        lastLoaded = loaded;
        lastTime = now;
        
        return formatBytes(speed) + '/s';
    }

    // Process ZIP data (common for both download and upload)
    async function processZipData(zipData) {
        try {
            updateStatus('Extracting ZIP file...', 60);
            
            // Load the ZIP file using JSZip
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(zipData);
            
            updateStatus('Analyzing repository structure...', 70);
            
            // Extract files and build repository structure
            repoFiles = [];
            repoStructure = {};
            
            // Get the root folder name (first directory in the ZIP)
            let rootFolderName = '';
            for (const filename in loadedZip.files) {
                const parts = filename.split('/');
                if (parts.length > 1 && parts[0]) {
                    rootFolderName = parts[0];
                    break;
                }
            }
            
            // Process each file in the ZIP
            const filePromises = [];
            loadedZip.forEach((relativePath, zipEntry) => {
                // Skip directories and hidden files/folders
                if (zipEntry.dir || isHiddenPath(relativePath)) return;
                
                // Remove the root folder name from the path
                let normalizedPath = relativePath;
                if (rootFolderName && normalizedPath.startsWith(rootFolderName + '/')) {
                    normalizedPath = normalizedPath.substring(rootFolderName.length + 1);
                }
                
                // Skip empty paths
                if (!normalizedPath) return;
                
                // Add file to processing queue
                filePromises.push(
                    zipEntry.async('string').then(content => {
                        repoFiles.push({
                            path: normalizedPath,
                            content,
                            selected: true // Default to selected
                        });
                    })
                );
            });
            
            // Wait for all files to be processed
            await Promise.all(filePromises);
            
            // Sort files by path
            repoFiles.sort((a, b) => a.path.localeCompare(b.path));
            
            // Build file tree structure
            buildFileTreeStructure();
            
            // Render the file tree
            renderFileTree();
            
            // Show file tree section
            fileTreeSection.classList.remove('hidden');
            
            updateStatus('Repository loaded successfully!', 100);
            
        } catch (error) {
            console.error('Error processing ZIP:', error);
            updateStatus(`Error processing ZIP: ${error.message}`, 0);
        }
    }
    
    // Check if a path is hidden (starts with . or contains /./)
    function isHiddenPath(path) {
        const parts = path.split('/');
        return parts.some(part => part.startsWith('.'));
    }
    
    // Build file tree structure from flat file list
    function buildFileTreeStructure() {
        repoStructure = {};
        
        repoFiles.forEach(file => {
            const pathParts = file.path.split('/');
            let currentLevel = repoStructure;
            
            // Navigate through path parts to build the tree
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                
                if (!currentLevel[part]) {
                    currentLevel[part] = {};
                }
                
                currentLevel = currentLevel[part];
            }
            
            // Add the file at the leaf level
            const fileName = pathParts[pathParts.length - 1];
            currentLevel[fileName] = file.path;
        });
    }
    
    // Render file tree from structure
    function renderFileTree() {
        fileTree.innerHTML = '';
        const rootUl = document.createElement('ul');
        
        // Recursively build the tree
        buildTreeNode(rootUl, repoStructure, '');
        
        fileTree.appendChild(rootUl);
        
        // Add event listeners to checkboxes
        const checkboxes = fileTree.querySelectorAll('input[type="checkbox"][data-path]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const filePath = e.target.getAttribute('data-path');
                const fileObj = repoFiles.find(f => f.path === filePath);
                
                if (fileObj) {
                    fileObj.selected = e.target.checked;
                }
            });
        });
        
        // Add event listeners to folder checkboxes
        const folderCheckboxes = fileTree.querySelectorAll('.folder-checkbox');
        folderCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const folderPath = e.target.getAttribute('data-folder');
                
                // Get all file checkboxes in this folder
                const childFileCheckboxes = fileTree.querySelectorAll(`input[type="checkbox"][data-path^="${folderPath}/"]`);
                childFileCheckboxes.forEach(childCheckbox => {
                    childCheckbox.checked = isChecked;
                    
                    // Update file selection state
                    const filePath = childCheckbox.getAttribute('data-path');
                    if (filePath) {
                        const fileObj = repoFiles.find(f => f.path === filePath);
                        if (fileObj) {
                            fileObj.selected = isChecked;
                        }
                    }
                });
                
                // Get all folder checkboxes in this folder
                const childFolderCheckboxes = fileTree.querySelectorAll(`.folder-checkbox[data-folder^="${folderPath}/"]`);
                childFolderCheckboxes.forEach(childCheckbox => {
                    childCheckbox.checked = isChecked;
                    childCheckbox.indeterminate = false;
                });
                
                // Update parent folders
                updateParentFolders(e.target);
            });
        });
    }
    
    // Update parent folder checkboxes
    function updateParentFolders(checkbox) {
        const folderPath = checkbox.getAttribute('data-folder');
        if (!folderPath) return;
        
        const pathParts = folderPath.split('/');
        
        // Skip if we're at the root
        if (pathParts.length <= 1) return;
        
        // Remove the last part to get the parent folder path
        pathParts.pop();
        const parentPath = pathParts.join('/');
        
        // Find the parent checkbox
        const parentCheckbox = fileTree.querySelector(`.folder-checkbox[data-folder="${parentPath}"]`);
        if (!parentCheckbox) return;
        
        updateFolderCheckboxState(parentCheckbox, parentPath);
        
        // Recursively update parent folders
        updateParentFolders(parentCheckbox);
    }

    // Update folder checkbox state based on children
    function updateFolderCheckboxState(checkbox, folderPath) {
        // Get all file checkboxes in this folder
        const childFileCheckboxes = fileTree.querySelectorAll(`input[type="checkbox"][data-path^="${folderPath}/"]`);
        
        // Get all folder checkboxes in this folder
        const childFolderCheckboxes = fileTree.querySelectorAll(`.folder-checkbox[data-folder^="${folderPath}/"]`);
        
        let allChecked = true;
        let allUnchecked = true;
        
        // Check file checkboxes
        childFileCheckboxes.forEach(childCheckbox => {
            if (childCheckbox.checked) {
                allUnchecked = false;
            } else {
                allChecked = false;
            }
        });
        
        // Check folder checkboxes
        childFolderCheckboxes.forEach(childCheckbox => {
            if (childCheckbox === checkbox) return; // Skip the current checkbox
            
            if (childCheckbox.checked) {
                allUnchecked = false;
            } else if (childCheckbox.indeterminate) {
                allChecked = false;
                allUnchecked = false;
            } else {
                allChecked = false;
            }
        });
        
        if (allChecked) {
            checkbox.checked = true;
            checkbox.indeterminate = false;
        } else if (allUnchecked) {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        } else {
            checkbox.indeterminate = true;
        }
    }

    // Build tree node recursively
    function buildTreeNode(parentElement, nodeObj, currentPath) {
        const sortedKeys = Object.keys(nodeObj).sort((a, b) => {
            // Folders first, then files
            const aIsFolder = typeof nodeObj[a] === 'object';
            const bIsFolder = typeof nodeObj[b] === 'object';
            
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            
            // Alphabetical order
            return a.localeCompare(b);
        });
        
        sortedKeys.forEach(key => {
            const li = document.createElement('li');
            const fullPath = currentPath ? `${currentPath}/${key}` : key;
            
            if (typeof nodeObj[key] === 'object') {
                // Folder
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'folder-checkbox';
                checkbox.checked = true;
                checkbox.setAttribute('data-folder', fullPath);
                
                const folderIcon = document.createElement('span');
                folderIcon.className = 'folder-icon';
                
                const folderName = document.createElement('span');
                folderName.className = 'folder-name';
                folderName.textContent = key;
                
                folderDiv.appendChild(checkbox);
                folderDiv.appendChild(folderIcon);
                folderDiv.appendChild(folderName);
                
                // Toggle folder when clicking on folder name or icon
                const toggleFolder = () => {
                    li.classList.toggle('expanded');
                    
                    // Update folder icon class instead of innerHTML
                    if (li.classList.contains('expanded')) {
                        folderIcon.classList.add('open');
                    } else {
                        folderIcon.classList.remove('open');
                    }
                };
                
                folderName.addEventListener('click', toggleFolder);
                folderIcon.addEventListener('click', toggleFolder);
                
                li.appendChild(folderDiv);
                
                // Create child list
                const ul = document.createElement('ul');
                li.appendChild(ul);
                
                // Build children
                buildTreeNode(ul, nodeObj[key], fullPath);
            } else {
                // File
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'file-checkbox';
                checkbox.checked = true;
                checkbox.setAttribute('data-path', fullPath);
                
                const fileIcon = document.createElement('span');
                fileIcon.className = 'file-icon';
                
                const fileName = document.createElement('span');
                fileName.className = 'file-name';
                fileName.textContent = key;
                
                // Add show file button
                const showFileBtn = document.createElement('button');
                showFileBtn.className = 'show-file-btn';
                showFileBtn.textContent = 'Show';
                showFileBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showFileInEditor(fullPath);
                });
                
                fileDiv.appendChild(checkbox);
                fileDiv.appendChild(fileIcon);
                fileDiv.appendChild(fileName);
                fileDiv.appendChild(showFileBtn);
                
                li.appendChild(fileDiv);
            }
            
            parentElement.appendChild(li);
        });
    }

    // Initialize Monaco Editor
    function initMonacoEditor() {
        if (monacoEditorLoaded) return Promise.resolve();
        
        return new Promise((resolve) => {
            // Define the require path
            require.config({ 
                paths: { 
                    'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' 
                }
            });
            
            // Load Monaco
            require(['vs/editor/editor.main'], function() {
                monacoEditorLoaded = true;
                resolve();
            });
        });
    }
    
    // Show file in Monaco Editor
    function showFileInEditor(filePath) {
        console.log('Opening file in editor:', filePath);
        
        // Find the file object
        const fileObj = repoFiles.find(f => f.path === filePath);
        if (!fileObj) {
            console.error('File not found:', filePath);
            return;
        }
        
        // Set the file name in the modal header
        editorFileName.textContent = filePath;
        
        // Make sure the modal is visible
        editorModal.classList.remove('hidden');
        editorModal.classList.add('show');
        editorModal.style.display = 'flex';
        
        // Wait a bit for the modal to be fully visible
        setTimeout(() => {
            // Initialize Monaco editor
            initMonacoEditor().then(() => {
                console.log('Monaco editor initialized');
                
                // Create editor if it doesn't exist
                if (!monacoEditor) {
                    console.log('Creating new Monaco editor instance');
                    monacoEditor = monaco.editor.create(monacoEditorContainer, {
                        automaticLayout: true,
                        theme: 'vs',
                        scrollBeyondLastLine: false,
                        minimap: { enabled: true },
                        readOnly: true
                    });
                }
                
                // Get language for syntax highlighting
                const language = getLanguageFromExtension(filePath);
                console.log('Language detected:', language);
                
                // Set content and language
                if (monacoEditor.getModel()) {
                    monacoEditor.getModel().setValue(fileObj.content);
                    monaco.editor.setModelLanguage(monacoEditor.getModel(), language);
                } else {
                    const model = monaco.editor.createModel(fileObj.content, language);
                    monacoEditor.setModel(model);
                }
                
                // Force layout update
                setTimeout(() => {
                    if (monacoEditor) {
                        monacoEditor.layout();
                    }
                }, 100);
            }).catch(err => {
                console.error('Error initializing Monaco editor:', err);
            });
        }, 50);
    }
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
        editorModal.classList.remove('show');
        editorModal.classList.add('hidden');
        editorModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editorModal) {
            editorModal.classList.remove('show');
            editorModal.classList.add('hidden');
            editorModal.style.display = 'none';
        }
    });
    
    // Generate text representation of the repository
    async function generateText() {
        try {
            // Check if there are any selected files
            const selectedFiles = repoFiles.filter(file => file.selected);
            if (selectedFiles.length === 0) {
                alert('Please select at least one file to include in the output.');
                return;
            }
            
            updateStatus('Generating text representation...', 80);
            
            // Start building the output text
            let output = '';
            
            // Add repository outline
            output += '<repo_structure>\n';
            output += '.\n';  // Root directory marker
            output += generateOutline(repoStructure);
            output += '</repo_structure>\n\n';
            
            // Add file contents
            for (const file of selectedFiles) {
                output += `<file path="${file.path}">\n`;
                
                // Determine language for code block based on file extension
                const language = getLanguageFromExtension(file.path);
                output += '```' + language + '\n';
                output += file.content;
                output += '\n```\n';
                
                output += '</file>\n\n';
            }
            
            // Set the result text
            resultText = output;
            
            // Display the result
            displayResult();
            
            // Show result section
            resultSection.classList.remove('hidden');
            
            updateStatus('Text representation generated successfully!', 100);
            
        } catch (error) {
            console.error('Error generating text:', error);
            updateStatus(`Error generating text: ${error.message}`, 0);
        }
    }
    
    // Generate outline of repository structure
    function generateOutline(structure, prefix = '', isLast = true, parentPrefix = '') {
        let outline = '';
        
        const keys = Object.keys(structure);
        const filteredKeys = [];
        
        // First pass: filter keys to only include selected files and folders with selected content
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = structure[key];
            
            if (typeof value === 'string') {
                // This is a file - check if it's selected
                const fileObj = repoFiles.find(f => f.path === value);
                if (fileObj && fileObj.selected) {
                    filteredKeys.push(key);
                }
            } else {
                // This is a directory - check if it has any selected files
                const hasSelectedContent = hasSelectedFiles(value);
                if (hasSelectedContent) {
                    filteredKeys.push(key);
                }
            }
        }
        
        // Second pass: generate outline with filtered keys
        for (let i = 0; i < filteredKeys.length; i++) {
            const key = filteredKeys[i];
            const value = structure[key];
            const isLastItem = i === filteredKeys.length - 1;
            
            // Current item prefix
            const itemPrefix = isLast ? '└── ' : '├── ';
            // Prefix for children items
            const childPrefix = isLast ? '    ' : '│   ';
            
            if (typeof value === 'string') {
                // This is a file
                outline += parentPrefix + itemPrefix + key + '\n';
            } else {
                // This is a directory
                outline += parentPrefix + itemPrefix + key + '/\n';
                outline += generateOutline(
                    value, 
                    prefix + '  ', 
                    isLastItem,
                    parentPrefix + childPrefix
                );
            }
        }
        
        return outline;
    }
    
    // Helper function to check if a folder has any selected files
    function hasSelectedFiles(folderStructure) {
        for (const key in folderStructure) {
            const value = folderStructure[key];
            
            if (typeof value === 'string') {
                // This is a file - check if it's selected
                const fileObj = repoFiles.find(f => f.path === value);
                if (fileObj && fileObj.selected) {
                    return true;
                }
            } else {
                // This is a directory - check recursively
                if (hasSelectedFiles(value)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Get language for code block based on file extension
    function getLanguageFromExtension(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        
        // Map of file extensions to languages
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'md': 'markdown',
            'py': 'python',
            'rb': 'ruby',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'cpp',
            'go': 'go',
            'php': 'php',
            'sh': 'bash',
            'bat': 'batch',
            'ps1': 'powershell',
            'sql': 'sql',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'swift': 'swift',
            'kt': 'kotlin',
            'rs': 'rust',
            'dart': 'dart',
            'lua': 'lua',
            'r': 'r',
            'pl': 'perl',
            'pm': 'perl',
            'scala': 'scala'
        };
        
        return languageMap[extension] || '';
    }
    
    // Display the result with syntax highlighting
    function displayResult() {
        // Set the content
        resultDisplay.innerHTML = `<code>${escapeHtml(resultText)}</code>`;
        
        // Estimate tokens
        const tokenCount = estimateTokenCount(resultText);
        tokenEstimate.textContent = `Estimated tokens: ${tokenCount.toLocaleString()}`;
    }
    
    // Escape HTML special characters
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Estimate token count using tiktoken
    function estimateTokenCount(text) {
        try {
            // Try to use tiktoken if available
            if (typeof tiktoken !== 'undefined') {
                const encoding = tiktoken.encoding_for_model('gpt-4');
                return encoding.encode(text).length;
            } else {
                // Fallback to rough estimation
                return Math.ceil(text.length / 4);
            }
        } catch (error) {
            console.error('Error estimating tokens:', error);
            // Fallback to rough estimation
            return Math.ceil(text.length / 4);
        }
    }
    
    // Copy result to clipboard
    function copyToClipboard() {
        try {
            navigator.clipboard.writeText(resultText).then(() => {
                alert('Text copied to clipboard!');
            });
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            
            // Fallback method
            const textarea = document.createElement('textarea');
            textarea.value = resultText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Text copied to clipboard!');
        }
    }
    
    // Download result as text file
    function downloadAsText() {
        try {
            const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, 'repo-text.txt');
        } catch (error) {
            console.error('Error downloading text:', error);
            alert('Error downloading text: ' + error.message);
        }
    }

    // Toggle all files selection
    function toggleAllFiles(selected) {
        repoFiles.forEach(file => {
            file.selected = selected;
        });
        
        // Update checkboxes in the UI
        const checkboxes = fileTree.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selected;
            checkbox.indeterminate = false;
        });
    }
    
    // Invert file selection
    function invertSelection() {
        repoFiles.forEach(file => {
            file.selected = !file.selected;
        });
        
        // Update file checkboxes in the UI
        const fileCheckboxes = fileTree.querySelectorAll('input[type="checkbox"][data-path]');
        fileCheckboxes.forEach(checkbox => {
            const filePath = checkbox.getAttribute('data-path');
            const fileObj = repoFiles.find(f => f.path === filePath);
            
            if (fileObj) {
                checkbox.checked = fileObj.selected;
            }
        });
        
        // Update folder checkboxes based on their children
        const folderCheckboxes = fileTree.querySelectorAll('.folder-checkbox');
        folderCheckboxes.forEach(checkbox => {
            const folderPath = checkbox.getAttribute('data-folder');
            updateFolderCheckboxState(checkbox, folderPath);
        });
    }
    
    // Update folder checkboxes based on their children's state
    function updateFolderCheckboxes() {
        const folderCheckboxes = fileTree.querySelectorAll('.folder-checkbox');
        
        folderCheckboxes.forEach(checkbox => {
            const folderPath = checkbox.getAttribute('data-folder');
            updateFolderCheckboxState(checkbox, folderPath);
        });
    }

    // Initialize
    function init() {
        // Hide sections initially
        statusSection.classList.add('hidden');
        fileTreeSection.classList.add('hidden');
        resultSection.classList.add('hidden');
    }

    // Update status display
    function updateStatus(message, progress) {
        statusMessage.textContent = message;
        
        if (progress >= 0) {
            progressBar.style.width = `${progress}%`;
            progressInfo.textContent = `${progress}%`;
        }
    }

    // Call init
    init();
});
