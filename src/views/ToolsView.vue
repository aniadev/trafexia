<script setup lang="ts">
import { ref, computed } from 'vue';
import { FileCode, Search, Copy, Download } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { generatePostmanFromUrls } from '@/utils/postmanExport';

const toast = useToast();
const analyzing = ref(false);
const results = ref<string[]>([]);
const dragActive = ref(false);
const fileName = ref('');
const searchQuery = ref('');

async function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    dragActive.value = false;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        await analyzeFile(file);
    }
}

async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        await analyzeFile(input.files[0]);
    }
}

async function analyzeFile(file: File) {
    const path = (file as any).path; // Electron specific
    if (!path) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Cannot resolve file path', life: 3000 });
        return;
    }

    if (!file.name.endsWith('.apk') && !file.name.endsWith('.xapk')) {
        toast.add({ severity: 'warn', summary: 'Invalid File', detail: 'Please select an APK or XAPK file', life: 3000 });
        return;
    }

    fileName.value = file.name;
    analyzing.value = true;
    results.value = [];

    try {
        const urls = await window.electronAPI.analyzeApk(path);
        results.value = urls;
        toast.add({ severity: 'success', summary: 'Analysis Complete', detail: `Found ${urls.length} endpoints`, life: 3000 });
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Analysis Failed', detail: String(error), life: 3000 });
    } finally {
        analyzing.value = false;
    }
}

function copyResult(text: string) {
    navigator.clipboard.writeText(text);
    toast.add({ severity: 'info', summary: 'Copied', detail: 'URL copied to clipboard', life: 1000 });
}


function exportResults() {
    if (results.value.length === 0) return;
    const content = results.value.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.value}_endpoints.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportPostman() {
    if (results.value.length === 0) return;
    try {
        const content = generatePostmanFromUrls(results.value, `${fileName.value} Analysis`);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.value}_postman_collection.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.add({ severity: 'success', summary: 'Exported', detail: 'Postman Collection created', life: 3000 });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Export Failed', detail: String(e), life: 3000 });
    }
}


const computedResults = computed(() => {
    if (!searchQuery.value) return results.value;
    return results.value.filter(u => u.toLowerCase().includes(searchQuery.value.toLowerCase()));
});
</script>

<template>
    <div class="tools-view">
        <div class="tools-header">
            <h2>APK Static Analyzer</h2>
            <p>Extract API endpoints from APK/XAPK files without running them.</p>
        </div>

        <!-- Upload Area -->
        <div class="upload-area" :class="{ active: dragActive }" @dragenter.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false" @dragover.prevent @drop="handleFileDrop">
            <input type="file" id="file-upload" accept=".apk,.xapk" @change="handleFileSelect" hidden />
            <label for="file-upload" class="upload-label">
                <FileCode v-if="!analyzing" class="upload-icon" />
                <div v-else class="spinner"></div>

                <span v-if="analyzing" class="upload-text">Analyzing {{ fileName }}... This may take a moment.</span>
                <span v-else class="upload-text">
                    Drag & Drop APK/XAPK here or <span class="highlight">Click to Browse</span>
                </span>
            </label>
        </div>

        <!-- Results Area -->
        <div v-if="results.length > 0 || analyzing" class="results-container">
            <div class="results-toolbar">
                <div class="search-box">
                    <Search class="search-icon" />
                    <input v-model="searchQuery" placeholder="Filter endpoints..." />
                </div>
                <div class="actions">
                    <span class="count">{{ computedResults.length }} URLs found</span>
                    <button @click="exportResults" class="btn btn-sm" title="Export as Text">
                        <FileCode class="w-4 h-4 mr-1" /> TXT
                    </button>
                    <button @click="exportPostman" class="btn btn-sm" title="Export to Postman">
                        <Download class="w-4 h-4 mr-1" /> Postman
                    </button>
                </div>
            </div>

            <div class="results-list custom-scrollbar">
                <div v-for="url in computedResults" :key="url" class="result-item">
                    <span class="url-text" :title="url">{{ url }}</span>
                    <button @click="copyResult(url)" class="copy-btn" title="Copy">
                        <Copy class="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tools-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    max-width: 1000px;
    margin: 0 auto;
    gap: 24px;
    color: #c9d1d9;
}

.tools-header h2 {
    font-size: 24px;
    font-weight: 600;
    color: #e6edf3;
    margin-bottom: 8px;
}

.tools-header p {
    color: #8b949e;
    font-size: 14px;
}

.upload-area {
    border: 2px dashed #30363d;
    border-radius: 12px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0d1117;
    transition: all 0.2s;
}

.upload-area.active {
    border-color: #58a6ff;
    background: rgba(88, 166, 255, 0.05);
}

.upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    width: 100%;
    height: 100%;
    justify-content: center;
}

.upload-icon {
    width: 48px;
    height: 48px;
    color: #8b949e;
}

.upload-text {
    font-size: 16px;
    color: #8b949e;
}

.highlight {
    color: #58a6ff;
    font-weight: 600;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(88, 166, 255, 0.3);
    border-radius: 50%;
    border-top-color: #58a6ff;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.results-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    min-height: 0;
}

.results-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.search-box {
    display: flex;
    align-items: center;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 0 12px;
    height: 36px;
    width: 300px;
}

.search-icon {
    width: 16px;
    height: 16px;
    color: #8b949e;
    margin-right: 8px;
}

.search-box input {
    background: none;
    border: none;
    color: #c9d1d9;
    width: 100%;
    outline: none;
    font-size: 14px;
}

.actions {
    display: flex;
    align-items: center;
    gap: 16px;
}

.count {
    color: #8b949e;
    font-size: 14px;
}

.btn {
    display: flex;
    align-items: center;
    background: #21262d;
    border: 1px solid rgba(240, 246, 252, 0.1);
    color: #c9d1d9;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 13px;
    cursor: pointer;
    transition: 0.2s;
}

.btn:hover {
    background: #30363d;
    border-color: #8b949e;
}

.results-list {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow-y: auto;
    flex: 1;
    padding: 8px 0;
}

.result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid #21262d;
}

.result-item:last-child {
    border-bottom: none;
}

.result-item:hover {
    background: rgba(110, 118, 129, 0.05);
}

.url-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #58a6ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 16px;
}

.copy-btn {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.2s;
}

.copy-btn:hover {
    color: #c9d1d9;
    background: rgba(110, 118, 129, 0.1);
}

.custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #0d1117;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 5px;
    border: 2px solid #0d1117;
}
</style>
