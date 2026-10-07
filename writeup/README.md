# BlockchainForkTree - Modular Overleaf Journal Project

This repository directory contains the complete, publication-ready, modular LaTeX project for the scientific article:
> **"A Federated Fork-Tree Blockchain Architecture with On-Chain Shared Consortium Governance for Resilient, Privacy-Preserving Healthcare Interoperability and Immutable Auditability"**
> *Targeted for IEEE Transactions on Services Computing / IEEE Journal of Biomedical and Health Informatics (J-BHI)*

---

## 📁 Modular Project Structure

```
overleaf_forktree_journal/
├── main.tex                          # Master LaTeX Document (\documentclass[lettersize,journal]{IEEEtran})
├── references.bib                    # Curated BibTeX bibliography (45+ peer-reviewed citations)
├── overleaf_forktree_journal.zip     # Complete, self-contained Overleaf ready-to-upload archive
├── sections/
│   ├── 00_abstract.tex               # Structured Abstract & IEEE Index Terms
│   ├── 01_introduction.tex           # Healthcare data trilemma, hypothesis, RQ1-RQ4, contributions
│   ├── 02_related_work.tex           # Taxonomic literature survey & Table I comparison matrix
│   ├── 03_system_architecture.tex    # Arborescence graph T=(V,E), lineage heights, hybrid crypto
│   ├── 04_governance_consensus.tex   # Dynamic fork proposals, quorum predicate Phi(Pi), node engine
│   ├── 05_rbac_consent.tex           # Two-layer security, Table II permission matrix, consent gatekeeper
│   ├── 06_fhir_messaging.tex         # Verifiable 5-state asynchronous FHIR order-fulfillment gateway
│   ├── 07_traversal_algorithms.tex   # BFS-EHR & DFS-EHR algorithms, completeness & integrity proofs
│   ├── 08_security_threat_model.tex  # Adversary model, Table III threat matrix, GDPR Art. 17 proof
│   ├── 09_empirical_evaluation.tex   # 15 test suites, benchmark telemetry, gas cost & latency tables
│   ├── 10_discussion_policy.tex      # Epic/Cerner EHR integration, Table VII regulatory compliance
│   ├── 11_limitations_future.tex     # IBFT 2.0 consensus, zk-SNARKs, Layer-2 rollups, MPC HSM
│   └── 12_conclusion.tex             # Concluding synthesis & hypothesis validation
└── figures/
    ├── fig1_topology.tex             # Vector TikZ: Multi-chain directed fork-tree arborescence
    ├── fig2_crypto_vault.tex         # Vector TikZ: AES-256-GCM off-chain vault & on-chain hash anchoring
    ├── fig3_fhir_messaging.tex       # Vector TikZ: Cross-chain asynchronous order fulfillment sequence
    ├── fig4_governance_state.tex     # Vector TikZ: Fork proposal & consensus state machine
    ├── fig5_benchmarks.tex           # PGFPlots: Throughput scaling vs. monolithic ledger collapse
    └── fig6_consent_gate.tex         # Vector TikZ: Patient sovereign consent gatekeeper flowchart
```

---

## 🚀 How to Compile in Overleaf

### Option 1: Direct Zip Upload (Fastest & Recommended)
1. Navigate to [Overleaf](https://www.overleaf.com/).
2. Click **New Project** $\rightarrow$ **Upload Project**.
3. Select `overleaf_forktree_journal.zip` from this directory.
4. Overleaf automatically unpacks all sections and figures and compiles `main.tex`.

### Option 2: Folder Upload
1. In Overleaf, create a **Blank Project**.
2. Upload `main.tex`, `references.bib`, the `sections/` directory, and the `figures/` directory.
3. Click **Recompile**.

---

## ⚙️ Compilation Settings
- **TeX Engine**: `pdfLaTeX` (Default) or `XeLaTeX`
- **Document Class**: `\documentclass[lettersize,journal]{IEEEtran}` (Strict IEEE Transactions format)
- **Standard IEEE Packages**: `amsmath,amsfonts,amssymb,amsthm`, `algorithmic`, `algorithm`, `array`, `subfig` (with `caption=false`), `textcomp`, `stfloats`, `url`, `verbatim`, `graphicx`, `cite`, `booktabs`, `multirow`, `tabularx`, `tikz`, `pgfplots`, `hyperref`
- **Zero Overflow Guarantee**: All equations, figures, algorithms, and tables are mathematically bounded to fit within IEEE single-column ($\le 8.89\text{ cm}$) or double-column ($\le 18.1\text{ cm}$) widths without overfull hbox margins.
