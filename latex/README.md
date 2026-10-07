# BlockchainForkTree - Journal & Conference LaTeX Manuscripts

This directory contains the complete, publication-ready LaTeX manuscripts, vector TikZ figures, BibTeX references, and Overleaf-ready zip packages for the scientific article:
> **"A Federated Fork-Tree Blockchain Architecture with Shared Consortium Governance for Resilient Healthcare Interoperability and Immutable Auditability"**
> *Targeted for IEEE Transactions on Services Computing / IEEE Journal of Biomedical and Health Informatics (J-BHI)*

---

## 📁 Project Structure

```
latex/
├── main.tex                    # Primary Journal Manuscript (IEEEtran journal layout)
├── journal_main.tex            # Full Journal Manuscript replica
├── main_conference.tex         # Original Conference Paper version (IEEEtran conference)
├── references.bib              # Complete BibTeX bibliography (45+ peer-reviewed citations)
├── figures/                    # Vector TikZ figure sources (pure vector TeX, zero PNG/JPG dependencies)
│   ├── fig1_topology.tex       # Multi-chain fork tree topology & lineage anchors (T = (V,E))
│   ├── fig2_crypto.tex         # Hybrid AES-256-GCM + SHA-256 cryptographic storage
│   └── fig3_fhir.tex           # Cross-fork HL7 FHIR request-fulfillment sequence
├── README.md                   # Documentation and Overleaf upload instructions
├── forktree_journal_latex.zip  # Overleaf ready-to-upload archive for the Journal paper
└── forktree_paper_latex.zip    # Synced Overleaf archive (points to journal main.tex)
```

---

## 🚀 How to Open and Compile in Overleaf

### Option 1: Direct Zip Upload (Fastest & Recommended)
1. Go to [Overleaf](https://www.overleaf.com/).
2. Click **New Project** $\rightarrow$ **Upload Project**.
3. Select `forktree_journal_latex.zip` (or `forktree_paper_latex.zip`) from this directory.
4. Overleaf will automatically unpack all files and compile `main.tex`.

### Option 2: Drag & Drop Folder Upload
1. In Overleaf, create a **Blank Project**.
2. Upload `main.tex`, `references.bib`, and the `figures/` folder.
3. Click **Recompile**.

---

## ⚙️ Compilation Settings
- **TeX Engine**: `pdfLaTeX` (Default) or `XeLaTeX`
- **Document Class**: `\documentclass[journal]{IEEEtran}`
- **Key Packages Included**: `amsmath`, `amssymb`, `tikz`, `algorithm`, `algpseudocode`, `booktabs`, `multirow`, `tabularx`, `hyperref`, `subcaption`

---

## 📊 Publication Figures & Key Inclusions
- **Figure 1**: Multi-chain fork-tree graph topology ($T = (V,E)$) with the Metadata Repository Chain ($C_{\text{repo}}$, Port 8545), Master Patient Index ($C_0$, Port 8546), and autonomous hospital/lab/pharmacy forks ($C_1$--$C_5$) with lineage block heights $\beta_{uv}$.
- **Figure 2**: Hybrid cryptographic storage pipeline displaying AES-256-GCM authenticated encryption for off-chain vaults and SHA-256 integrity anchoring on-chain for GDPR Article 17 / HIPAA compliance.
- **Figure 3**: Cross-fork HL7 FHIR order-fulfillment workflow showing asymmetric request dispatch, repository state machine transitions (`PENDING` $\rightarrow$ `FULFILLED`), and report verification.
- **Table I**: Comprehensive Taxonomic Comparison of Healthcare Architectures across 10 dimensions.
- **Table II**: Role-Based Access Control (RBAC) Persona Permission Matrix across 6 roles.
- **Table III**: Automated Experimental Test Results Across 15 Suites and 33 Test Cases (100% pass rate).
- **Table IV**: Smart Contract Execution Cost (Gas) and Latency Benchmarks.
- **Table V**: Traversal Performance ($\text{BFS-EHR}$ vs. $\text{DFS-EHR}$) Steps and Latency.
- **Table VI**: Statutory Regulatory Compliance Mapping (HIPAA Security Rule and GDPR Articles 5, 17, 32).
