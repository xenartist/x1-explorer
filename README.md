# X1 Blockchain Explorer

A static HTML+JS blockchain explorer for X1 blockchain (100% fork of Solana).

## Quick Start

### Method 1: Direct Open (Try this first)
1. Simply double-click `index.html` file
2. Or drag and drop the file into your browser

### Method 2: Local Server (If CORS issues occur)
```bash
# Start a local server
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

## Features
- 🔍 Search blocks, transactions, accounts, programs, and tokens
- 📊 Real-time recent blocks display  
- 🎯 Search result filtering by type
- 📱 Responsive design for mobile devices
- ⚡ Pure frontend implementation, no backend required

## Search Support
- **Numbers**: Block number search
- **Long strings**: Transaction signatures and account addresses
- **Automatic detection**: Smart search type recognition

## RPC Endpoint
- **Testnet**: https://rpc-testnet.x1.wiki

## Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting
If you encounter CORS errors when opening directly, use the local server method instead.
```