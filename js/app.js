class X1Explorer {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadRecentBlocks();
        
        // Update recent blocks every 30 seconds
        setInterval(() => this.loadRecentBlocks(), 30000);
    }

    bindEvents() {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');

        // Search button click
        searchBtn.addEventListener('click', () => this.performSearch());

        // Enter key search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        
        if (!query) {
            this.showError('Please enter search content');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideResults();

        try {
            const results = await rpc.search(query);
            this.showResults(results);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    showResults(results) {
        const resultsDiv = document.getElementById('results');
        const resultContent = document.getElementById('resultContent');
        const resultType = document.getElementById('resultType');

        // Show all results without filtering
        if (results.length === 0) {
            this.showError('No matching results found');
            return;
        }

        // Set result type based on the first result
        resultType.textContent = this.getTypeLabel(results[0].type);
        resultContent.innerHTML = '';

        results.forEach(result => {
            const resultElement = this.createResultElement(result);
            resultContent.appendChild(resultElement);
        });

        resultsDiv.classList.remove('hidden');
    }

    createResultElement(result) {
        const div = document.createElement('div');
        div.className = 'result-item';

        switch (result.type) {
            case 'block':
                div.innerHTML = this.formatBlockResult(result.data);
                break;
            case 'transaction':
                div.innerHTML = this.formatTransactionResult(result.data);
                break;
            case 'account':
                div.innerHTML = this.formatAccountResult(result.data, result.query);
                break;
            case 'program':
                div.innerHTML = this.formatProgramResult(result.data, result.query);
                break;
            case 'token':
                div.innerHTML = this.formatTokenResult(result.data, result.query);
                break;
            default:
                div.innerHTML = '<p>Unknown result type</p>';
        }

        return div;
    }

    formatBlockResult(block) {
        const blockTime = new Date(block.blockTime * 1000).toLocaleString('en-US');
        return `
            <div class="result-header">
                <h4>Block #${block.parentSlot + 1}</h4>
                <span class="timestamp">${blockTime}</span>
            </div>
            <div class="result-details">
                <p><strong>Block Hash:</strong> <code>${block.blockhash}</code></p>
                <p><strong>Parent Slot:</strong> ${block.parentSlot}</p>
                <p><strong>Transactions:</strong> ${block.transactions?.length || 0}</p>
                <p><strong>Rewards:</strong> ${block.rewards?.length || 0}</p>
                <p><strong>Block Height:</strong> ${block.blockHeight || 'N/A'}</p>
            </div>
        `;
    }

    formatTransactionResult(tx) {
        const status = tx.meta?.err ? 'Failed' : 'Success';
        const statusClass = tx.meta?.err ? 'error' : 'success';
        const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString('en-US') : 'N/A';
        
        // Handle different encoding formats for transaction data
        let signature = '';
        let accountKeys = [];
        let instructions = [];
        
        if (tx.transaction) {
            if (tx.transaction.signatures) {
                signature = tx.transaction.signatures[0];
            }
            
            if (tx.transaction.message) {
                accountKeys = tx.transaction.message.accountKeys || [];
                instructions = tx.transaction.message.instructions || [];
            }
        }
        
        return `
            <div class="result-header">
                <h4>Transaction</h4>
                <span class="status ${statusClass}">${status}</span>
            </div>
            <div class="result-details">
                <p><strong>Signature:</strong> <code>${signature}</code></p>
                <p><strong>Block Time:</strong> ${blockTime}</p>
                <p><strong>Block Height:</strong> ${tx.slot || 'N/A'}</p>
                <p><strong>Fee:</strong> ${tx.meta?.fee || 0} lamports</p>
                <p><strong>Compute Units Consumed:</strong> ${tx.meta?.computeUnitsConsumed || 0}</p>
                <p><strong>Account Count:</strong> ${accountKeys.length}</p>
                <p><strong>Instruction Count:</strong> ${instructions.length}</p>
                <p><strong>Log Messages:</strong> ${tx.meta?.logMessages?.length || 0}</p>
                <p><strong>Transaction Version:</strong> ${tx.version || 'legacy'}</p>
                ${tx.meta?.err ? `<p><strong>Error:</strong> <span class="error-text">${JSON.stringify(tx.meta.err)}</span></p>` : ''}
                ${tx.meta?.preBalances ? `<p><strong>Pre Balances:</strong> ${tx.meta.preBalances.join(', ')} lamports</p>` : ''}
                ${tx.meta?.postBalances ? `<p><strong>Post Balances:</strong> ${tx.meta.postBalances.join(', ')} lamports</p>` : ''}
            </div>
        `;
    }

    formatAccountResult(account, address) {
        const accountData = account.value;
        if (!accountData) {
            return `
                <div class="result-header">
                    <h4>Account</h4>
                    <span class="address">${address}</span>
                </div>
                <div class="result-details">
                    <p><strong>Status:</strong> Account does not exist or is closed</p>
                </div>
            `;
        }

        const balance = accountData.lamports / 1e9; // Convert to SOL
        
        return `
            <div class="result-header">
                <h4>Account</h4>
                <span class="address">${address}</span>
            </div>
            <div class="result-details">
                <p><strong>Balance:</strong> ${balance.toFixed(9)} SOL</p>
                <p><strong>Owner:</strong> <code>${accountData.owner}</code></p>
                <p><strong>Data Length:</strong> ${accountData.data ? accountData.data[0].length : 0} bytes</p>
                <p><strong>Executable:</strong> ${accountData.executable ? 'Yes' : 'No'}</p>
                <p><strong>Rent Exempt:</strong> ${accountData.lamports > 0 ? 'Yes' : 'No'}</p>
            </div>
        `;
    }

    formatProgramResult(program, programId) {
        return `
            <div class="result-header">
                <h4>Program</h4>
                <span class="address">${programId}</span>
            </div>
            <div class="result-details">
                <p><strong>Program ID:</strong> <code>${programId}</code></p>
                <p><strong>Account Count:</strong> ${program.length}</p>
                <p><strong>Type:</strong> Program Account</p>
            </div>
        `;
    }

    formatTokenResult(token, mint) {
        return `
            <div class="result-header">
                <h4>Token</h4>
                <span class="address">${mint}</span>
            </div>
            <div class="result-details">
                <p><strong>Token Address:</strong> <code>${mint}</code></p>
                <p><strong>Total Supply:</strong> ${token.value?.uiAmount || 'N/A'}</p>
                <p><strong>Decimals:</strong> ${token.value?.decimals || 'N/A'}</p>
                <p><strong>Raw Amount:</strong> ${token.value?.amount || 'N/A'}</p>
            </div>
        `;
    }

    async loadRecentBlocks() {
        try {
            // Show small loading indicator without clearing existing blocks
            this.showBlocksLoading();
            
            const currentSlot = await rpc.getSlot();
            const blockElements = [];
            
            // Get latest 5 blocks
            for (let i = 0; i < 5; i++) {
                const slot = currentSlot - i;
                try {
                    const block = await rpc.getBlock(slot);
                    if (block) {
                        const blockElement = this.createBlockElement(block, slot);
                        blockElements.push(blockElement);
                    }
                } catch (e) {
                    console.log(`Failed to get block ${slot}:`, e.message);
                    // If fetch fails, create a placeholder element
                    const placeholderElement = this.createBlockPlaceholder(slot);
                    blockElements.push(placeholderElement);
                }
            }
            
            // Only update the blocks list after all data is loaded
            const blocksList = document.getElementById('recentBlocksList');
            blocksList.innerHTML = '';
            blockElements.forEach(element => {
                blocksList.appendChild(element);
            });
            
            // Hide loading indicator
            this.hideBlocksLoading();
            
        } catch (error) {
            console.error('Failed to load recent blocks:', error);
            this.hideBlocksLoading();
            
            // Only show error if there are no existing blocks
            const blocksList = document.getElementById('recentBlocksList');
            if (blocksList.children.length === 0) {
                blocksList.innerHTML = '<div class="error-blocks">Failed to load, please try again later</div>';
            }
        }
    }

    // Add new methods for blocks loading state
    showBlocksLoading() {
        const recentBlocksSection = document.querySelector('.recent-blocks');
        const existingIndicator = recentBlocksSection.querySelector('.blocks-loading-indicator');
        
        // Don't add multiple loading indicators
        if (existingIndicator) return;
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'blocks-loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="small-spinner"></div>
            <span>Updating...</span>
        `;
        
        // Insert the loading indicator after the h3 title
        const title = recentBlocksSection.querySelector('h3');
        title.insertAdjacentElement('afterend', loadingIndicator);
    }

    hideBlocksLoading() {
        const loadingIndicator = document.querySelector('.blocks-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    createBlockElement(block, slot) {
        const div = document.createElement('div');
        div.className = 'block-item';
        
        const blockTime = block.blockTime ? new Date(block.blockTime * 1000).toLocaleString('en-US') : 'N/A';
        const txCount = block.transactions?.length || 0;
        
        div.innerHTML = `
            <div class="block-info">
                <span class="block-number">#${slot}</span>
                <span class="block-time">${blockTime}</span>
                <span class="block-txs">${txCount} txns</span>
            </div>
            <div class="block-hash">
                <small>Hash: ${block.blockhash}</small>
            </div>
        `;
        
        div.addEventListener('click', () => {
            document.getElementById('searchInput').value = slot;
            this.performSearch();
        });
        
        return div;
    }

    createBlockPlaceholder(slot) {
        const div = document.createElement('div');
        div.className = 'block-item placeholder';
        div.innerHTML = `
            <div class="block-info">
                <span class="block-number">#${slot}</span>
                <span class="block-time">Load failed</span>
                <span class="block-txs">- txns</span>
            </div>
        `;
        return div;
    }

    getTypeLabel(type) {
        const labels = {
            'block': 'Block',
            'transaction': 'Transaction',
            'account': 'Account',
            'program': 'Program',
            'token': 'Token'
        };
        return labels[type] || type;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Auto-hide error message after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    hideResults() {
        document.getElementById('results').classList.add('hidden');
    }

    // Format address display (truncate middle part)
    formatAddress(address, length = 8) {
        if (!address || address.length <= length * 2) return address;
        return `${address.slice(0, length)}...${address.slice(-length)}`;
    }

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard');
        } catch (err) {
            console.error('Copy failed:', err);
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Copied to clipboard');
        }
    }

    // Show notification
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }
}

// Initialize application after page load
document.addEventListener('DOMContentLoaded', () => {
    new X1Explorer();
});

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});


