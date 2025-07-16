class X1Explorer {
    constructor() {
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        // Store global reference for transaction search
        window.x1Explorer = this;
        
        this.bindEvents();
        this.initRPCSelector();
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

    // Initialize RPC selector
    initRPCSelector() {
        const rpcSelect = document.getElementById('rpcSelect');
        
        // Handle RPC selection change
        rpcSelect.addEventListener('change', (e) => {
            this.changeRPC(e.target.value);
        });
        
        // Initial connection test
        this.testRPCConnection();
    }

    // Change RPC endpoint
    async changeRPC(newUrl) {
        console.log('Changing RPC to:', newUrl);
        
        // Update status to connecting
        this.updateRPCStatus('connecting', 'Connecting...');
        
        // Update RPC instance
        rpc.updateUrl(newUrl);
        
        // Test new connection
        await this.testRPCConnection();
        
        // Reload TPS data with new endpoint
        this.loadTPS();
    }

    // Test RPC connection
    async testRPCConnection() {
        try {
            const result = await rpc.testConnection();
            if (result.connected) {
                this.updateRPCStatus('connected', 'Connected');
            } else {
                this.updateRPCStatus('disconnected', 'Failed');
            }
        } catch (error) {
            console.error('RPC connection test failed:', error);
            this.updateRPCStatus('disconnected', 'Failed');
        }
    }

    // Update RPC status display
    updateRPCStatus(status, text) {
        const statusElement = document.getElementById('rpcStatus');
        const statusIcon = document.getElementById('rpcStatusIcon');
        const statusText = document.getElementById('rpcStatusText');
        
        // Remove all status classes
        statusElement.classList.remove('connected', 'connecting', 'disconnected');
        
        // Add current status class
        statusElement.classList.add(status);
        
        // Update text
        statusText.textContent = text;
        
        // Update icon animation for connecting state
        if (status === 'connecting') {
            statusIcon.className = 'fas fa-circle fa-pulse';
        } else {
            statusIcon.className = 'fas fa-circle';
        }
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
            
            // If this is an account result and it's a vote account, load vote info
            if (result.type === 'account' && 
                result.data.value && 
                result.data.value.owner === 'Vote111111111111111111111111111111111111111') {
                this.loadVoteAccountInfo(result.query);
            }
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
        const transactions = block.transactions || [];
        const transactionCount = transactions.length;
        
        // Format transactions list with pagination
        const formatTransactionsList = () => {
            if (transactionCount === 0) {
                return '<p><i class="fas fa-info-circle"></i> No transactions in this block</p>';
            }
            
            // Create pagination for transactions (show 20 per page)
            const pageSize = 20;
            const totalPages = Math.ceil(transactionCount / pageSize);
            
            let paginationHTML = '';
            let transactionsHTML = '';
            
            // Generate pagination controls if needed
            if (totalPages > 1) {
                paginationHTML = `
                    <div class="pagination-controls">
                        <button onclick="showTransactionPage('${block.blockhash}', 1, ${pageSize}, ${transactionCount})" class="pagination-btn active" data-page="1">1</button>
                        ${totalPages > 1 ? `<button onclick="showTransactionPage('${block.blockhash}', 2, ${pageSize}, ${transactionCount})" class="pagination-btn" data-page="2">2</button>` : ''}
                        ${totalPages > 2 ? `<button onclick="showTransactionPage('${block.blockhash}', 3, ${pageSize}, ${transactionCount})" class="pagination-btn" data-page="3">3</button>` : ''}
                        ${totalPages > 3 ? '<span class="pagination-dots">...</span>' : ''}
                        ${totalPages > 3 ? `<button onclick="showTransactionPage('${block.blockhash}', ${totalPages}, ${pageSize}, ${transactionCount})" class="pagination-btn" data-page="${totalPages}">${totalPages}</button>` : ''}
                    </div>
                `;
            }
            
            // Generate first page of transactions
            const firstPageTransactions = transactions.slice(0, pageSize);
            transactionsHTML = firstPageTransactions.map((tx, index) => {
                // Extract transaction signature
                let signature = 'Unknown';
                if (tx.transaction && tx.transaction.signatures && tx.transaction.signatures.length > 0) {
                    signature = tx.transaction.signatures[0];
                }
                
                // Extract transaction status
                const status = tx.meta?.err ? 'Failed' : 'Success';
                const statusClass = tx.meta?.err ? 'tx-failed' : 'tx-success';
                
                // Extract fee
                const fee = tx.meta?.fee || 0;
                
                // Extract compute units
                const computeUnits = tx.meta?.computeUnitsConsumed || 0;
                
                // Count instructions
                const instructionCount = tx.transaction?.message?.instructions?.length || 0;
                
                return `
                    <div class="transaction-item" data-signature="${signature}">
                        <div class="transaction-header">
                            <div class="transaction-signature">
                                <i class="fas fa-receipt"></i>
                                <code class="signature-short" title="${signature}">${signature.slice(0, 8)}...${signature.slice(-8)}</code>
                                <button class="copy-btn" onclick="copyToClipboard('${signature}')" title="Copy full signature">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <span class="transaction-status ${statusClass}">
                                <i class="fas fa-${status === 'Success' ? 'check-circle' : 'times-circle'}"></i> ${status}
                            </span>
                        </div>
                        <div class="transaction-details">
                            <div class="detail-item">
                                <i class="fas fa-cogs"></i> Instructions: <strong>${instructionCount}</strong>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-dollar-sign"></i> Fee: <strong>${fee} lamports</strong>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-microchip"></i> Compute: <strong>${computeUnits}</strong>
                            </div>
                            <div class="detail-item">
                                <button class="view-tx-btn" onclick="searchTransaction('${signature}')">
                                    <i class="fas fa-eye"></i> View Details
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="transactions-container">
                    ${paginationHTML}
                    <div id="transactions-list-${block.blockhash}" class="transactions-list">
                        ${transactionsHTML}
                    </div>
                    ${totalPages > 1 ? paginationHTML : ''}
                </div>
            `;
        };
        
        return `
            <div class="result-header">
                <h4><i class="fas fa-cube"></i> Block #${block.parentSlot + 1}</h4>
                <span class="timestamp"><i class="fas fa-clock"></i> ${blockTime}</span>
            </div>
            <div class="result-details">
                <p><strong><i class="fas fa-fingerprint"></i> Block Hash:</strong> <code>${block.blockhash}</code></p>
                <p><strong><i class="fas fa-link"></i> Parent Slot:</strong> ${block.parentSlot}</p>
                <p><strong><i class="fas fa-receipt"></i> Transactions:</strong> ${transactionCount}</p>
                <p><strong><i class="fas fa-gift"></i> Rewards:</strong> ${block.rewards?.length || 0}</p>
                <p><strong><i class="fas fa-layer-group"></i> Block Height:</strong> ${block.blockHeight || 'N/A'}</p>
                
                <!-- Transactions List -->
                ${transactionCount > 0 ? `
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('transactions-${block.blockhash}')">
                        <i class="fas fa-chevron-down toggle-icon"></i> <i class="fas fa-list"></i> Transaction List: ${transactionCount}
                    </h5>
                    <div id="transactions-${block.blockhash}" class="section-content">
                        ${formatTransactionsList()}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    formatTransactionResult(tx) {
        const status = tx.meta?.err ? 'Failed' : 'Success';
        const statusClass = tx.meta?.err ? 'error' : 'success';
        const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString('en-US') : 'N/A';
        
        // Handle different encoding formats for transaction data - with safe defaults
        let signature = '';
        let accountKeys = [];
        let instructions = [];
        
        try {
            if (tx.transaction) {
                if (tx.transaction.signatures && Array.isArray(tx.transaction.signatures)) {
                    signature = tx.transaction.signatures[0] || '';
                }
                
                if (tx.transaction.message) {
                    accountKeys = tx.transaction.message.accountKeys || [];
                    instructions = tx.transaction.message.instructions || [];
                    
                    // Ensure these are arrays
                    if (!Array.isArray(accountKeys)) accountKeys = [];
                    if (!Array.isArray(instructions)) instructions = [];
                }
            }
        } catch (e) {
            console.error('Error parsing transaction data:', e);
            // Reset to safe defaults
            signature = tx.transaction?.signatures?.[0] || 'Unknown';
            accountKeys = [];
            instructions = [];
        }

        const logMessages = tx.meta?.logMessages || [];
        // Ensure logMessages is an array
        const safeLogMessages = Array.isArray(logMessages) ? logMessages : [];
        
        // Format account keys with safety checks
        const formatAccountKeys = () => {
            if (!Array.isArray(accountKeys) || accountKeys.length === 0) {
                return '<p><i class="fas fa-info-circle"></i> No account keys found</p>';
            }
            
            return accountKeys.map((account, index) => {
                // Handle both string format and object format safely
                let address = 'Unknown';
                if (typeof account === 'string') {
                    address = account;
                } else if (account && typeof account === 'object') {
                    address = account.pubkey || account.address || 'Unknown';
                }
                
                const signer = (typeof account === 'object' && account?.signer) ? ' <i class="fas fa-key" title="Signer"></i>' : '';
                const writable = (typeof account === 'object' && account?.writable) ? ' <i class="fas fa-edit" title="Writable"></i>' : '';
                
                return `<div class="account-item">
                    <span class="account-index">#${index}:</span>
                    <code class="account-address">${address}</code>
                    <span class="account-flags">${signer}${writable}</span>
                </div>`;
            }).join('');
        };

        // Format instructions with safety checks
        const formatInstructions = () => {
            if (!Array.isArray(instructions) || instructions.length === 0) {
                return '<p><i class="fas fa-info-circle"></i> No instructions found</p>';
            }
            
            return instructions.map((instruction, index) => {
                if (!instruction) return '';
                
                // Handle different instruction formats (parsed vs raw)
                let programId = '';
                let programName = '';
                let instructionType = '';
                let accounts = [];
                let data = '';

                try {
                    if (instruction.parsed) {
                        // Parsed instruction format
                        programId = instruction.program || 'Unknown';
                        programName = instruction.programId || programId;
                        instructionType = instruction.parsed.type || 'Unknown';
                        
                        if (instruction.parsed.info) {
                            const info = instruction.parsed.info;
                            // Extract key information based on instruction type
                            if (info.source) accounts.push(`<i class="fas fa-arrow-right"></i> Source: ${info.source}`);
                            if (info.destination) accounts.push(`<i class="fas fa-arrow-left"></i> Destination: ${info.destination}`);
                            if (info.authority) accounts.push(`<i class="fas fa-shield-alt"></i> Authority: ${info.authority}`);
                            if (info.amount) accounts.push(`<i class="fas fa-coins"></i> Amount: ${info.amount}`);
                            if (info.mint) accounts.push(`<i class="fas fa-coins"></i> Mint: ${info.mint}`);
                        }
                    } else {
                        // Raw instruction format
                        programId = instruction.programIdIndex !== undefined ? 
                            `Account Index: ${instruction.programIdIndex}` : 'Unknown';
                        accounts = (instruction.accounts && Array.isArray(instruction.accounts)) ? 
                            instruction.accounts.map(acc => `<i class="fas fa-user"></i> Account Index: ${acc}`) : [];
                        data = instruction.data || '';
                    }
                } catch (e) {
                    console.error('Error parsing instruction:', e);
                    programId = 'Error parsing instruction';
                    accounts = [];
                    data = '';
                }

                // Ensure accounts is an array
                if (!Array.isArray(accounts)) accounts = [];

                return `<div class="instruction-item">
                    <div class="instruction-header">
                        <strong><i class="fas fa-cog"></i> Instruction #${index + 1}</strong>
                        ${instructionType ? `<span class="instruction-type"><i class="fas fa-tag"></i> ${instructionType}</span>` : ''}
                    </div>
                    <div class="instruction-details">
                        <p><strong><i class="fas fa-code"></i> Program:</strong> <code>${programId}</code></p>
                        ${accounts.length > 0 ? `<p><strong><i class="fas fa-users"></i> Accounts:</strong></p><div class="instruction-accounts">${accounts.map(acc => `<div>${acc}</div>`).join('')}</div>` : ''}
                        ${data ? `<p><strong><i class="fas fa-database"></i> Data:</strong> <code class="instruction-data">${data}</code></p>` : ''}
                    </div>
                </div>`;
            }).join('');
        };

        // Format log messages with safety checks
        const formatLogMessages = () => {
            if (!Array.isArray(safeLogMessages) || safeLogMessages.length === 0) {
                return '<p><i class="fas fa-info-circle"></i> No log messages</p>';
            }
            
            return safeLogMessages.map((message, index) => {
                const safeMessage = message || '';
                // Add appropriate icon based on message content
                let icon = 'fas fa-info';
                if (safeMessage.toLowerCase().includes('error')) {
                    icon = 'fas fa-exclamation-triangle';
                } else if (safeMessage.toLowerCase().includes('success')) {
                    icon = 'fas fa-check-circle';
                } else if (safeMessage.toLowerCase().includes('invoke')) {
                    icon = 'fas fa-play';
                }
                
                return `<div class="log-item">
                    <span class="log-index">#${index + 1}:</span>
                    <span class="log-message"><i class="${icon}"></i> ${safeMessage}</span>
                </div>`;
            }).join('');
        };
        
        // Ensure we have safe values for template strings
        const safeAccountKeysLength = Array.isArray(accountKeys) ? accountKeys.length : 0;
        const safeInstructionsLength = Array.isArray(instructions) ? instructions.length : 0;
        const safeLogMessagesLength = Array.isArray(safeLogMessages) ? safeLogMessages.length : 0;
        const safeSignature = signature || 'Unknown';
        
        return `
            <div class="result-header">
                <h4><i class="fas fa-receipt"></i> Transaction</h4>
                <span class="status ${statusClass}">
                    <i class="fas fa-${status === 'Success' ? 'check-circle' : 'times-circle'}"></i> ${status}
                </span>
            </div>
            <div class="result-details">
                <p><strong><i class="fas fa-signature"></i> Signature:</strong> <code>${safeSignature}</code></p>
                <p><strong><i class="fas fa-clock"></i> Block Time:</strong> ${blockTime}</p>
                <p><strong><i class="fas fa-layer-group"></i> Block Height:</strong> ${tx.slot || 'N/A'}</p>
                <p><strong><i class="fas fa-dollar-sign"></i> Fee:</strong> ${tx.meta?.fee || 0} lamports</p>
                <p><strong><i class="fas fa-microchip"></i> Compute Units Consumed:</strong> ${tx.meta?.computeUnitsConsumed || 0}</p>
                <p><strong><i class="fas fa-code-branch"></i> Transaction Version:</strong> ${tx.version || 'legacy'}</p>
                ${tx.meta?.preBalances ? `<p><strong><i class="fas fa-wallet"></i> Pre Balances:</strong> ${tx.meta.preBalances.join(', ')} lamports</p>` : ''}
                ${tx.meta?.postBalances ? `<p><strong><i class="fas fa-wallet"></i> Post Balances:</strong> ${tx.meta.postBalances.join(', ')} lamports</p>` : ''}
                ${tx.meta?.err ? `<p><strong><i class="fas fa-exclamation-triangle"></i> Error:</strong> <span class="error-text">${JSON.stringify(tx.meta.err)}</span></p>` : ''}
                
                <!-- Account Details -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('accounts-${safeSignature.slice(-8)}')">
                        <i class="fas fa-chevron-down toggle-icon"></i> <i class="fas fa-users"></i> Account Count: ${safeAccountKeysLength}
                    </h5>
                    <div id="accounts-${safeSignature.slice(-8)}" class="section-content">
                        ${formatAccountKeys()}
                    </div>
                </div>

                <!-- Instruction Details -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('instructions-${safeSignature.slice(-8)}')">
                        <i class="fas fa-chevron-down toggle-icon"></i> <i class="fas fa-cogs"></i> Instruction Count: ${safeInstructionsLength}
                    </h5>
                    <div id="instructions-${safeSignature.slice(-8)}" class="section-content">
                        ${formatInstructions()}
                    </div>
                </div>

                <!-- Log Messages -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleSection('logs-${safeSignature.slice(-8)}')">
                        <i class="fas fa-chevron-down toggle-icon"></i> <i class="fas fa-list-alt"></i> Log Messages: ${safeLogMessagesLength}
                    </h5>
                    <div id="logs-${safeSignature.slice(-8)}" class="section-content">
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
                    <h4><i class="fas fa-user"></i> Account</h4>
                    <span class="address">${address}</span>
                </div>
                <div class="result-details">
                    <p><strong><i class="fas fa-info-circle"></i> Status:</strong> Account does not exist or is closed</p>
                </div>
            `;
        }

        const balance = accountData.lamports / 1e9; // Convert to SOL
        const isVoteAccount = accountData.owner === 'Vote111111111111111111111111111111111111111';
        
        // Format account transactions list
        const formatAccountTransactions = () => {
            return `
                <div class="transactions-container">
                    <div class="pagination-controls" id="account-tx-pagination-${address.slice(-8)}">
                        <!-- Pagination will be inserted here -->
                    </div>
                    <div id="account-transactions-list-${address.slice(-8)}" class="account-transactions-list">
                        <div class="loading-transactions">
                            <i class="fas fa-spinner fa-spin"></i> Loading transactions...
                        </div>
                    </div>
                </div>
            `;
        };
        
        return `
            <div class="result-header">
                <h4><i class="fas fa-user"></i> Account</h4>
                <span class="address">${address}</span>
            </div>
            <div class="result-details">
                <p><strong><i class="fas fa-wallet"></i> Balance:</strong> ${balance.toFixed(9)} SOL</p>
                <p><strong><i class="fas fa-user-tie"></i> Owner:</strong> <code>${accountData.owner}</code></p>
                <p><strong><i class="fas fa-database"></i> Data Length:</strong> ${accountData.data ? accountData.data[0].length : 0} bytes</p>
                <p><strong><i class="fas fa-play"></i> Executable:</strong> ${accountData.executable ? '✓ Yes' : '✗ No'}</p>
                <p><strong><i class="fas fa-shield-alt"></i> Rent Exempt:</strong> ${accountData.lamports > 0 ? '✓ Yes' : '✗ No'}</p>
                
                <!-- Vote Account Information (only for vote accounts) -->
                ${isVoteAccount ? `
                <div id="vote-info-${address.slice(-8)}" class="vote-account-section">
                    <div class="loading-vote-info">
                        <i class="fas fa-spinner fa-spin"></i> Loading vote account information...
                    </div>
                </div>
                ` : ''}
                
                <!-- Account Transactions List -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleAccountTransactions('${address}')">
                        <i class="fas fa-chevron-down toggle-icon" id="account-tx-icon-${address.slice(-8)}"></i> 
                        <i class="fas fa-list"></i> Transaction History
                    </h5>
                    <div id="account-transactions-${address.slice(-8)}" class="section-content">
                        ${formatAccountTransactions()}
                    </div>
                </div>
            </div>
        `;
    }

    formatProgramResult(program, programId) {
        // Handle case where program data might be undefined or null
        if (!program) {
            return `
                <div class="result-header">
                    <h4><i class="fas fa-code"></i> Program</h4>
                    <span class="address">${programId}</span>
                </div>
                <div class="result-details">
                    <p><strong><i class="fas fa-address-card"></i> Program ID:</strong> <code>${programId}</code></p>
                    <p><strong><i class="fas fa-info-circle"></i> Status:</strong> Program not found or inactive</p>
                </div>
            `;
        }

        const balance = program.lamports ? (program.lamports / 1e9).toFixed(9) : '0';
        const dataLength = program.data ? (Array.isArray(program.data) ? program.data[0].length : program.data.length) : 0;
        
        // Format program transactions list
        const formatProgramTransactions = () => {
            return `
                <div class="transactions-container">
                    <div class="pagination-controls" id="program-tx-pagination-${programId.slice(-8)}">
                        <!-- Pagination will be inserted here -->
                    </div>
                    <div id="program-transactions-list-${programId.slice(-8)}" class="program-transactions-list">
                        <div class="loading-transactions">
                            <i class="fas fa-spinner fa-spin"></i> Loading program transactions...
                        </div>
                    </div>
                </div>
            `;
        };
        
        return `
            <div class="result-header">
                <h4><i class="fas fa-code"></i> Program</h4>
                <span class="address">${programId}</span>
            </div>
            <div class="result-details">
                <p><strong><i class="fas fa-address-card"></i> Program ID:</strong> <code>${programId}</code></p>
                <p><strong><i class="fas fa-wallet"></i> Balance:</strong> ${balance} SOL</p>
                <p><strong><i class="fas fa-user-tie"></i> Owner:</strong> <code>${program.owner || 'Unknown'}</code></p>
                <p><strong><i class="fas fa-database"></i> Data Length:</strong> ${dataLength} bytes</p>
                <p><strong><i class="fas fa-play"></i> Executable:</strong> <i class="fas fa-check-circle" style="color: #28a745;"></i> Yes</p>
                <p><strong><i class="fas fa-shield-alt"></i> Rent Exempt:</strong> ${program.lamports > 0 ? '✓ Yes' : '✗ No'}</p>
                
                <!-- Program Transaction History -->
                <div class="expandable-section">
                    <h5 class="section-header" onclick="toggleProgramTransactions('${programId}')">
                        <i class="fas fa-chevron-down toggle-icon" id="program-tx-icon-${programId.slice(-8)}"></i> 
                        <i class="fas fa-code-branch"></i> Program Transaction History
                    </h5>
                    <div id="program-transactions-${programId.slice(-8)}" class="section-content">
                        ${formatProgramTransactions()}
                    </div>
                </div>
            </div>
        `;
    }

    formatTokenResult(token, mint) {
        return `
            <div class="result-header">
                <h4><i class="fas fa-coins"></i> Token</h4>
                <span class="address">${mint}</span>
            </div>
            <div class="result-details">
                <p><strong><i class="fas fa-address-card"></i> Token Address:</strong> <code>${mint}</code></p>
                <p><strong><i class="fas fa-chart-line"></i> Total Supply:</strong> ${token.value?.uiAmount || 'N/A'}</p>
                <p><strong><i class="fas fa-decimal"></i> Decimals:</strong> ${token.value?.decimals || 'N/A'}</p>
                <p><strong><i class="fas fa-hashtag"></i> Raw Amount:</strong> ${token.value?.amount || 'N/A'}</p>
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

    // Move this function inside the X1Explorer class (before the last closing brace)
    async loadVoteAccountInfo(address) {
        try {
            const voteInfo = await rpc.getVoteAccountCredits(address);
            if (voteInfo) {
                const voteSection = document.getElementById(`vote-info-${address.slice(-8)}`);
                if (voteSection) {
                    // Calculate total credits from epochCredits array
                    const totalCredits = voteInfo.epochCredits ? 
                        voteInfo.epochCredits[voteInfo.epochCredits.length - 1]?.[1] || 0 : 0;
                    
                    voteSection.innerHTML = `
                        <div class="vote-account-info">
                            <h5><i class="fas fa-vote-yea"></i> Vote Account Information</h5>
                            <div class="vote-details">
                                <p><strong><i class="fas fa-chart-line"></i> Credits:</strong> ${totalCredits}</p>
                                <p><strong><i class="fas fa-user-tie"></i> Vote Authority:</strong> <code>${voteInfo.nodePubkey || 'N/A'}</code></p>
                                <p><strong><i class="fas fa-percentage"></i> Commission:</strong> ${voteInfo.commission || 0}%</p>
                                <p><strong><i class="fas fa-toggle-on"></i> Active:</strong> ${voteInfo.activatedStake > 0 ? 'Yes' : 'No'}</p>
                                <p><strong><i class="fas fa-coins"></i> Activated Stake:</strong> ${(voteInfo.activatedStake / 1e9).toFixed(2)} SOL</p>
                                ${voteInfo.lastVote ? `<p><strong><i class="fas fa-clock"></i> Last Vote:</strong> ${voteInfo.lastVote}</p>` : ''}
                                ${voteInfo.rootSlot ? `<p><strong><i class="fas fa-layer-group"></i> Root Slot:</strong> ${voteInfo.rootSlot}</p>` : ''}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load vote account information:', error);
            const voteSection = document.getElementById(`vote-info-${address.slice(-8)}`);
            if (voteSection) {
                voteSection.innerHTML = `
                    <div class="vote-account-info">
                        <h5><i class="fas fa-vote-yea"></i> Vote Account Information</h5>
                        <p class="error-message">
                            <i class="fas fa-exclamation-triangle"></i> 
                            Failed to load vote account details: ${error.message}
                        </p>
                    </div>
                `;
            }
        }
    }
}

// Toggle section visibility function (global function for onclick)
window.toggleSection = function(sectionId) {
    const content = document.getElementById(sectionId);
    const header = content.previousElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    // check current state and switch
    if (content.classList.contains('expanded')) {
        // current is expanded, to fold
        content.classList.remove('expanded');
        header.classList.remove('expanded');
        icon.classList.remove('expanded');
        icon.className = 'fas fa-chevron-down toggle-icon';
    } else {
        // current is folded, to expand
        content.classList.add('expanded');
        header.classList.add('expanded');
        icon.classList.add('expanded');
        icon.className = 'fas fa-chevron-up toggle-icon';
    }
};

// Global function for transaction pagination
window.showTransactionPage = function(blockHash, page, pageSize, totalTransactions) {
    const container = document.getElementById(`transactions-list-${blockHash}`);
    if (!container) return;
    
    // Get the block data from the current results (we need to store it)
    const resultContent = document.getElementById('resultContent');
    const blockElement = resultContent.querySelector(`[data-block-hash="${blockHash}"]`);
    
    // For now, we'll reload the transactions from the stored block data
    // In a real implementation, you might want to store the block data globally
    console.log(`Loading page ${page} for block ${blockHash}`);
    
    // Update pagination buttons
    const paginationBtns = container.parentElement.querySelectorAll('.pagination-btn');
    paginationBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page == page) {
            btn.classList.add('active');
        }
    });
    
    // This is a placeholder - in a full implementation, you'd calculate and display the correct page
    container.innerHTML = `<p><i class="fas fa-info-circle"></i> Loading page ${page}...</p>`;
};

// Global function to copy text to clipboard
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary notification
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = '<i class="fas fa-check"></i> Copied to clipboard!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};

// Global function to search for a specific transaction
window.searchTransaction = function(signature) {
    document.getElementById('searchInput').value = signature;
    const explorer = window.x1Explorer || new X1Explorer();
    explorer.performSearch();
};

// Global function to toggle account transactions
window.toggleAccountTransactions = async function(address) {
    const addressShort = address.slice(-8);
    const content = document.getElementById(`account-transactions-${addressShort}`);
    const icon = document.getElementById(`account-tx-icon-${addressShort}`);
    const transactionsList = document.getElementById(`account-transactions-list-${addressShort}`);
    
    if (content.style.display === 'none' || content.style.display === '') {
        // Expand and load transactions
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-up toggle-icon';
        
        // Load first page of transactions if not loaded yet
        if (transactionsList.innerHTML.includes('Loading transactions...')) {
            await loadAccountTransactions(address, 1);
        }
    } else {
        // Collapse
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-down toggle-icon';
    }
};

// Global function to toggle program transactions
window.toggleProgramTransactions = async function(programId) {
    const programIdShort = programId.slice(-8);
    const content = document.getElementById(`program-transactions-${programIdShort}`);
    const icon = document.getElementById(`program-tx-icon-${programIdShort}`);
    const transactionsList = document.getElementById(`program-transactions-list-${programIdShort}`);
    
    if (content.style.display === 'none' || content.style.display === '') {
        // Expand and load transactions
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-up toggle-icon';
        
        // Load first page of transactions if not loaded yet
        if (transactionsList.innerHTML.includes('Loading program transactions...')) {
            await loadProgramTransactions(programId, 1);
        }
    } else {
        // Collapse
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-down toggle-icon';
    }
};

// Function to load account transactions with pagination
async function loadAccountTransactions(address, page = 1, pageSize = 20) {
    const addressShort = address.slice(-8);
    const transactionsList = document.getElementById(`account-transactions-list-${addressShort}`);
    const paginationContainer = document.getElementById(`account-tx-pagination-${addressShort}`);
    
    try {
        // Show loading
        transactionsList.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-spinner fa-spin"></i> Loading page ${page}...
            </div>
        `;
        
        // Calculate offset for pagination
        const before = page > 1 ? window.accountTransactionCache?.[address]?.[(page - 1) * pageSize - 1]?.signature : undefined;
        
        // Get transaction signatures
        const signatures = await rpc.getSignaturesForAddress(address, {
            limit: pageSize,
            before: before
        });
        
        if (signatures.length === 0) {
            transactionsList.innerHTML = '<p><i class="fas fa-info-circle"></i> No transactions found for this account</p>';
            paginationContainer.innerHTML = '';
            return;
        }
        
        // Store in cache for pagination
        if (!window.accountTransactionCache) window.accountTransactionCache = {};
        if (!window.accountTransactionCache[address]) window.accountTransactionCache[address] = [];
        
        // Add to cache
        const startIndex = (page - 1) * pageSize;
        signatures.forEach((sig, index) => {
            window.accountTransactionCache[address][startIndex + index] = sig;
        });
        
        // Generate transaction list HTML
        const transactionsHTML = signatures.map((sig, index) => {
            const globalIndex = (page - 1) * pageSize + index;
            const status = sig.err ? 'Failed' : 'Success';
            const statusClass = sig.err ? 'tx-failed' : 'tx-success';
            const blockTime = sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString('en-US') : 'Unknown';
            const signature = sig.signature;
            
            return `
                <div class="account-transaction-item" data-signature="${signature}">
                    <div class="transaction-header">
                        <div class="transaction-signature">
                            <span class="tx-index">#${globalIndex + 1}</span>
                            <i class="fas fa-receipt"></i>
                            <code class="signature-short" title="${signature}">${signature.slice(0, 8)}...${signature.slice(-8)}</code>
                            <button class="copy-btn" onclick="copyToClipboard('${signature}')" title="Copy full signature">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <span class="transaction-status ${statusClass}">
                            <i class="fas fa-${status === 'Success' ? 'check-circle' : 'times-circle'}"></i> ${status}
                        </span>
                    </div>
                    <div class="transaction-details">
                        <div class="detail-item">
                            <i class="fas fa-clock"></i> Time: <strong>${blockTime}</strong>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-layer-group"></i> Slot: <strong>${sig.slot || 'N/A'}</strong>
                        </div>
                        ${sig.err ? `<div class="detail-item error-detail">
                            <i class="fas fa-exclamation-triangle"></i> Error: <strong>${JSON.stringify(sig.err)}</strong>
                        </div>` : ''}
                        <div class="detail-item">
                            <button class="view-tx-btn" onclick="searchTransaction('${signature}')">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update transactions list
        transactionsList.innerHTML = transactionsHTML;
        
        // Generate pagination controls
        const hasMore = signatures.length === pageSize; // Assume there might be more if we got a full page
        generateAccountTransactionPagination(address, page, hasMore);
        
    } catch (error) {
        console.error('Failed to load account transactions:', error);
        transactionsList.innerHTML = `
            <p class="error-message">
                <i class="fas fa-exclamation-triangle"></i> 
                Failed to load transactions: ${error.message}
            </p>
        `;
        paginationContainer.innerHTML = '';
    }
}

// Generate pagination controls for account transactions
function generateAccountTransactionPagination(address, currentPage, hasMore) {
    const addressShort = address.slice(-8);
    const paginationContainer = document.getElementById(`account-tx-pagination-${addressShort}`);
    
    if (currentPage === 1 && !hasMore) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button onclick="loadAccountTransactions('${address}', ${currentPage - 1})" class="pagination-btn">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
    }
    
    // Current page indicator
    paginationHTML += `<span class="pagination-info">Page ${currentPage}</span>`;
    
    // Next button
    if (hasMore) {
        paginationHTML += `
            <button onclick="loadAccountTransactions('${address}', ${currentPage + 1})" class="pagination-btn">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
}

// Make loadAccountTransactions globally accessible
window.loadAccountTransactions = loadAccountTransactions;

// Function to load program transactions with pagination
async function loadProgramTransactions(programId, page = 1, pageSize = 20) {
    const programIdShort = programId.slice(-8);
    const transactionsList = document.getElementById(`program-transactions-list-${programIdShort}`);
    const paginationContainer = document.getElementById(`program-tx-pagination-${programIdShort}`);
    
    try {
        // Show loading
        transactionsList.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-spinner fa-spin"></i> Loading program transactions page ${page}...
            </div>
        `;
        
        // Calculate offset for pagination
        const before = page > 1 ? window.programTransactionCache?.[programId]?.[(page - 1) * pageSize - 1]?.signature : undefined;
        
        // Get transaction signatures for the program
        const signatures = await rpc.getSignaturesForAddress(programId, {
            limit: pageSize,
            before: before
        });
        
        if (signatures.length === 0) {
            transactionsList.innerHTML = '<p><i class="fas fa-info-circle"></i> No transactions found for this program</p>';
            paginationContainer.innerHTML = '';
            return;
        }
        
        // Store in cache for pagination
        if (!window.programTransactionCache) window.programTransactionCache = {};
        if (!window.programTransactionCache[programId]) window.programTransactionCache[programId] = [];
        
        // Add to cache
        const startIndex = (page - 1) * pageSize;
        signatures.forEach((sig, index) => {
            window.programTransactionCache[programId][startIndex + index] = sig;
        });
        
        // Generate transaction list HTML
        const transactionsHTML = signatures.map((sig, index) => {
            const globalIndex = (page - 1) * pageSize + index;
            const status = sig.err ? 'Failed' : 'Success';
            const statusClass = sig.err ? 'tx-failed' : 'tx-success';
            const blockTime = sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString('en-US') : 'Unknown';
            const signature = sig.signature;
            
            return `
                <div class="program-transaction-item" data-signature="${signature}">
                    <div class="transaction-header">
                        <div class="transaction-signature">
                            <span class="tx-index">#${globalIndex + 1}</span>
                            <i class="fas fa-code-branch"></i>
                            <code class="signature-short" title="${signature}">${signature.slice(0, 8)}...${signature.slice(-8)}</code>
                            <button class="copy-btn" onclick="copyToClipboard('${signature}')" title="Copy full signature">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <span class="transaction-status ${statusClass}">
                            <i class="fas fa-${status === 'Success' ? 'check-circle' : 'times-circle'}"></i> ${status}
                        </span>
                    </div>
                    <div class="transaction-details">
                        <div class="detail-item">
                            <i class="fas fa-clock"></i> Time: <strong>${blockTime}</strong>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-layer-group"></i> Slot: <strong>${sig.slot || 'N/A'}</strong>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-code"></i> Program Interaction
                        </div>
                        ${sig.err ? `<div class="detail-item error-detail">
                            <i class="fas fa-exclamation-triangle"></i> Error: <strong>${JSON.stringify(sig.err)}</strong>
                        </div>` : ''}
                        <div class="detail-item">
                            <button class="view-tx-btn" onclick="searchTransaction('${signature}')">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update transactions list
        transactionsList.innerHTML = transactionsHTML;
        
        // Generate pagination controls
        const hasMore = signatures.length === pageSize; // Assume there might be more if we got a full page
        generateProgramTransactionPagination(programId, page, hasMore);
        
    } catch (error) {
        console.error('Failed to load program transactions:', error);
        transactionsList.innerHTML = `
            <p class="error-message">
                <i class="fas fa-exclamation-triangle"></i> 
                Failed to load program transactions: ${error.message}
            </p>
        `;
        paginationContainer.innerHTML = '';
    }
}

// Generate pagination controls for program transactions
function generateProgramTransactionPagination(programId, currentPage, hasMore) {
    const programIdShort = programId.slice(-8);
    const paginationContainer = document.getElementById(`program-tx-pagination-${programIdShort}`);
    
    if (currentPage === 1 && !hasMore) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button onclick="loadProgramTransactions('${programId}', ${currentPage - 1})" class="pagination-btn">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
    }
    
    // Current page indicator
    paginationHTML += `<span class="pagination-info">Page ${currentPage}</span>`;
    
    // Next button
    if (hasMore) {
        paginationHTML += `
            <button onclick="loadProgramTransactions('${programId}', ${currentPage + 1})" class="pagination-btn">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
}

// Make loadProgramTransactions globally accessible
window.loadProgramTransactions = loadProgramTransactions;

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


