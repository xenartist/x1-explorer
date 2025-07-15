class X1Explorer {
    constructor() {
        this.tpsData = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTPS();
        
        // Update TPS every 30 seconds (since performance samples are taken every 60 seconds)
        setInterval(() => this.loadTPS(), 30000);
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

        const logMessages = tx.meta?.logMessages || [];
        
        // Format account keys
        const formatAccountKeys = () => {
            if (accountKeys.length === 0) return '<p>No account keys found</p>';
            
            return accountKeys.map((account, index) => {
                // Handle both string format and object format
                const address = typeof account === 'string' ? account : account.pubkey;
                const signer = typeof account === 'object' && account.signer ? ' (Signer)' : '';
                const writable = typeof account === 'object' && account.writable ? ' (Writable)' : '';
                
                return `<div class="account-item">
                    <span class="account-index">#${index}:</span>
                    <code class="account-address">${address}</code>
                    <span class="account-flags">${signer}${writable}</span>
                </div>`;
            }).join('');
        };

        // Format instructions
        const formatInstructions = () => {
            if (instructions.length === 0) return '<p>No instructions found</p>';
            
            return instructions.map((instruction, index) => {
                // Handle different instruction formats (parsed vs raw)
                let programId = '';
                let programName = '';
                let instructionType = '';
                let accounts = [];
                let data = '';

                if (instruction.parsed) {
                    // Parsed instruction format
                    programId = instruction.program || 'Unknown';
                    programName = instruction.programId || programId;
                    instructionType = instruction.parsed.type || 'Unknown';
                    
                    if (instruction.parsed.info) {
                        const info = instruction.parsed.info;
                        // Extract key information based on instruction type
                        if (info.source) accounts.push(`Source: ${info.source}`);
                        if (info.destination) accounts.push(`Destination: ${info.destination}`);
                        if (info.authority) accounts.push(`Authority: ${info.authority}`);
                        if (info.amount) accounts.push(`Amount: ${info.amount}`);
                        if (info.mint) accounts.push(`Mint: ${info.mint}`);
                    }
                } else {
                    // Raw instruction format
                    programId = instruction.programIdIndex !== undefined ? 
                        `Account Index: ${instruction.programIdIndex}` : 'Unknown';
                    accounts = instruction.accounts ? 
                        instruction.accounts.map(acc => `Account Index: ${acc}`) : [];
                    data = instruction.data || '';
                }

                return `<div class="instruction-item">
                    <div class="instruction-header">
                        <strong>Instruction #${index + 1}</strong>
                        ${instructionType ? `<span class="instruction-type">${instructionType}</span>` : ''}
                    </div>
                    <div class="instruction-details">
                        <p><strong>Program:</strong> <code>${programId}</code></p>
                        ${accounts.length > 0 ? `<p><strong>Accounts:</strong></p><div class="instruction-accounts">${accounts.map(acc => `<div>${acc}</div>`).join('')}</div>` : ''}
                        ${data ? `<p><strong>Data:</strong> <code class="instruction-data">${data}</code></p>` : ''}
                    </div>
                </div>`;
            }).join('');
        };

        // Format log messages
        const formatLogMessages = () => {
            if (logMessages.length === 0) return '<p>No log messages</p>';
            
            return logMessages.map((message, index) => {
                return `<div class="log-item">
                    <span class="log-index">#${index + 1}:</span>
                    <span class="log-message">${message}</span>
                </div>`;
            }).join('');
        };
        
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
                <p><strong>Transaction Version:</strong> ${tx.version || 'legacy'}</p>
                ${tx.meta?.preBalances ? `<p><strong>Pre Balances:</strong> ${tx.meta.preBalances.join(', ')} lamports</p>` : ''}
                ${tx.meta?.postBalances ? `<p><strong>Post Balances:</strong> ${tx.meta.postBalances.join(', ')} lamports</p>` : ''}
                ${tx.meta?.err ? `<p><strong>Error:</strong> <span class="error-text">${JSON.stringify(tx.meta.err)}</span></p>` : ''}
                
                <!-- Account Details -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('accounts-${signature.slice(-8)}')">
                        <span class="toggle-icon">▼</span> Account Count: ${accountKeys.length}
                    </h5>
                    <div id="accounts-${signature.slice(-8)}" class="section-content">
                        ${formatAccountKeys()}
                    </div>
                </div>

                <!-- Instruction Details -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('instructions-${signature.slice(-8)}')">
                        <span class="toggle-icon">▼</span> Instruction Count: ${instructions.length}
                    </h5>
                    <div id="instructions-${signature.slice(-8)}" class="section-content">
                        ${formatInstructions()}
                    </div>
                </div>

                <!-- Log Messages -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('logs-${signature.slice(-8)}')">
                        <span class="toggle-icon">▼</span> Log Messages: ${logMessages.length}
                    </h5>
                    <div id="logs-${signature.slice(-8)}" class="section-content">
                        ${formatLogMessages()}
                    </div>
                </div>
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

    async loadTPS() {
        try {
            // No loading animation - directly get and update TPS data
            const tpsData = await rpc.getAllTPS();
            this.tpsData = tpsData;
            this.displayTPS(tpsData);
        } catch (error) {
            console.error('Failed to load TPS:', error);
            this.displayTPSError();
        }
    }

    displayTPS(tpsData) {
        const tpsContainer = document.getElementById('tpsContainer');
        
        if (tpsData.error) {
            tpsContainer.innerHTML = `
                <div class="tps-grid">
                    <div class="tps-item error">
                        <span class="tps-label">Total TPS:</span>
                        <span class="tps-value">Error</span>
                    </div>
                    <div class="tps-item error">
                        <span class="tps-label">True TPS:</span>
                        <span class="tps-value">Error</span>
                    </div>
                    <div class="tps-item error">
                        <span class="tps-label">Vote TPS:</span>
                        <span class="tps-value">Error</span>
                    </div>
                </div>
            `;
            return;
        }

        const totalTPS = tpsData.totalTPS.toFixed(1);
        const trueTPS = tpsData.trueTPS.toFixed(1);
        const voteTPS = tpsData.voteTPS.toFixed(1);
        
        // Get TPS classes for color coding
        const totalClass = this.getTPSClass(tpsData.totalTPS);
        const trueClass = this.getTPSClass(tpsData.trueTPS);
        const voteClass = this.getTPSClass(tpsData.voteTPS);
        
        tpsContainer.innerHTML = `
            <div class="tps-grid">
                <div class="tps-item ${totalClass}">
                    <span class="tps-label">Total TPS:</span>
                    <span class="tps-value">${totalTPS}</span>
                </div>
                <div class="tps-item ${trueClass}">
                    <span class="tps-label">True TPS:</span>
                    <span class="tps-value">${trueTPS}</span>
                </div>
                <div class="tps-item ${voteClass}">
                    <span class="tps-label">Vote TPS:</span>
                    <span class="tps-value">${voteTPS}</span>
                </div>
            </div>
        `;
    }

    getTPSClass(tps) {
        if (tps > 1000) return 'tps-high';
        if (tps > 100) return 'tps-medium';
        return 'tps-low';
    }

    displayTPSError() {
        const tpsContainer = document.getElementById('tpsContainer');
        tpsContainer.innerHTML = `
            <div class="tps-grid">
                <div class="tps-item error">
                    <span class="tps-label">Total TPS:</span>
                    <span class="tps-value">Error</span>
                </div>
                <div class="tps-item error">
                    <span class="tps-label">True TPS:</span>
                    <span class="tps-value">Error</span>
                </div>
                <div class="tps-item error">
                    <span class="tps-label">Vote TPS:</span>
                    <span class="tps-value">Error</span>
                </div>
            </div>
        `;
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

// Toggle section visibility function (global function for onclick)
window.toggleSection = function(sectionId) {
    const content = document.getElementById(sectionId);
    const header = content.previousElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        icon.textContent = '▲';
        header.classList.add('expanded');
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
        header.classList.remove('expanded');
    }
};

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


