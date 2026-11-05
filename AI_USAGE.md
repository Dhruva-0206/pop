# AI usage disclosure

ETHGlobal allows AI-assisted development if it is disclosed. This file lists every AI tool, what it did, which files it touched, and what humans reviewed.

## Planning (before code; written after hacking began at 9 PM Thu)
The planning documents in `specs/` were written with AI assistance and are included unchanged, as the spec-driven rule requires:
- `specs/Bharosa_Build_Spec_v3.md`, `specs/PoP_Technical_Architecture.md`, `specs/Bharaso_ETHGlobal_Mumbai_Winning_Plan.md`, `specs/ETHGlobal_Mumbai_2026_Context.md`, `specs/ETHGlobal_Mumbai_2026_Rules_Guidelines_Bharaso.md`
- Organizer confirmation that these may be included: _pending (gate 7)_.

## Build log
| When (IST) | Tool | Purpose | Files | Human review |
|---|---|---|---|---|
| Thu 5 Nov 23:45 → | Claude Code (Claude Opus 5.5) | Lead-engineer agent following the team's written prompt: repo setup, Foundry install, docs lookup, scaffolding | `.gitignore`, `README.md`, `CLAUDE.md`, `AI_USAGE.md`, `.env.example` | Team chose the tool options (Foundry via Git Bash, kept LICENSE); reviews each commit |

The prompt given to the agent is saved in `specs/prompts/`.

## Rules we follow
- Humans make the product and sponsor decisions; the agent proposes and implements.
- Every contract change gets tests; the team reviews the contract before any testnet deploy.
- No secrets are shown to or logged by the AI tool; private keys live only in the local `.env`.
