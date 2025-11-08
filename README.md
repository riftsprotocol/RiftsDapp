# Rifts Protocol DApp

A decentralized application for the Rifts Protocol - a next-generation Solana-based platform for tokenization, liquidity provision, and decentralized governance.

## Features

- **Rifts Protocol Integration**: Create and manage Rifts (tokenized positions) on Solana
- **DEX Integration**: Seamless swapping via Jupiter DEX aggregator
- **LP Staking**: Stake liquidity provider tokens through Meteora integration
- **Governance System**: Vote on protocol proposals and participate in DAO governance
- **Real-time Price Oracles**: Hybrid oracle system with Jupiter and Pyth integration
- **Advanced UI**: Modern, responsive interface with smooth animations
- **Wallet Integration**: Support for Phantom, Solflare, and other Solana wallets

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Blockchain**: Solana (Devnet/Mainnet)
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Wallet Adapter**: @solana/wallet-adapter-react
- **DEX Integration**: Jupiter Aggregator
- **Database**: Supabase (optional for caching)

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- A Solana wallet (Phantom, Solflare, etc.)
- Solana devnet/mainnet RPC endpoint (Alchemy, Helius, or custom)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/riftsprotocol/RiftsDapp.git
   cd RiftsDapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your credentials:
   ```env
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
   NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-devnet.g.alchemy.com/v2/your_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open the application**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Getting API Keys

### Alchemy (Required)
1. Sign up at [alchemy.com](https://www.alchemy.com/)
2. Create a new app for Solana
3. Copy your API key and RPC URL

### Supabase (Optional - for caching)
1. Sign up at [supabase.com](https://supabase.com/)
2. Create a new project
3. Get your project URL and anon key from Settings → API

## Project Structure

```
RiftsDapp/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── page.tsx      # Landing page
│   │   └── dapp/         # DApp interface
│   ├── components/       # React components
│   │   ├── rifts/        # Rifts-specific components
│   │   ├── trading/      # Trading interface
│   │   ├── governance/   # Governance panel
│   │   └── ui/           # Reusable UI components
│   ├── lib/              # Core utilities
│   │   └── solana/       # Solana integration logic
│   ├── services/         # API services
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
├── .env.example          # Environment variables template
└── package.json          # Dependencies
```

## Usage

### Connecting Your Wallet

1. Click "Connect Wallet" in the top navigation
2. Select your preferred Solana wallet
3. Approve the connection request

### Creating a Rift

1. Navigate to the DApp interface
2. Click "Create Rift"
3. Enter the amount and select token type
4. Confirm the transaction in your wallet

### Trading

1. Go to the Trading tab
2. Select tokens to swap
3. Enter amount and review the quote
4. Execute the swap through Jupiter DEX

### Staking

1. Navigate to the Staking section
2. Select your LP tokens
3. Choose staking duration
4. Confirm staking transaction

### Governance

1. Access the Governance panel
2. Browse active proposals
3. Vote on proposals using your governance tokens
4. Create new proposals (requires minimum token holdings)

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Security

- **Never commit** `.env` or `.env.local` files
- **Never share** your private keys or seed phrases
- All sensitive data is excluded via `.gitignore`
- Smart contracts are deployed on Solana devnet for testing

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Links

- **Website**: [riftsprotocol.com](https://riftsprotocol.com)
- **Documentation**: [docs.riftsprotocol.com](https://docs.riftsprotocol.com)
- **Twitter**: [@riftsprotocol](https://twitter.com/riftsprotocol)
- **Discord**: [Join our community](https://discord.gg/riftsprotocol)

## Support

For questions or issues:
- Open an issue on GitHub
- Join our Discord community
- Contact us on Twitter

---

Built with ❤️ by the Rifts Protocol team
