# BlockchainForkTree - Scientific Paper LaTeX Project

This directory contains the complete, publication-ready LaTeX project for the scientific article:
> **"A Federated Fork-Tree Blockchain Architecture with Shared Consortium Governance for Resilient Healthcare Interoperability and Immutable Auditability"**

---

## 📁 Project Structure

```
latex/
├── main.tex                  # Primary LaTeX manuscript (IEEEtran layout)
├── references.bib            # Complete BibTeX bibliography
├── figures/                  # Vector TikZ figure sources (no binary image dependencies)
│   ├── fig1_topology.tex     # Multi-chain fork tree topology & lineage anchors
│   ├── fig2_crypto.tex       # Hybrid AES-256-GCM + SHA-256 cryptographic storage
│   └── fig3_fhir.tex         # Cross-fork HL7 FHIR request-fulfillment sequence
├── README.md                 # Documentation and Overleaf upload instructions
└── forktree_paper_latex.zip  # Ready-to-upload Overleaf archive
```

---

## 🚀 How to Open in Overleaf

### Option 1: Direct Zip Upload (Fastest)
1. Go to [Overleaf](https://www.overleaf.com/).
2. Click **New Project** $\rightarrow$ **Upload Project**.
3. Select the file `forktree_paper_latex.zip` from this directory.
4. Overleaf will automatically extract the files and compile `main.tex`.

### Option 2: Folder Upload
1. In Overleaf, create a **Blank Project**.
2. Drag and drop `main.tex`, `references.bib`, and the `figures/` folder into the left-hand file tree.
3. Click **Recompile**.

---

## ⚙️ Compilation Settings
- **TeX Engine**: `pdfLaTeX` (Default) or `XeLaTeX`
- **Document Class**: `IEEEtran` (Conference / Journal)
- **Key Packages Included**: `amsmath`, `amssymb`, `tikz`, `algorithm`, `algpseudocode`, `booktabs`, `hyperref`, `subcaption`

---

## 📊 Included Publication Figures (TikZ)
- **Figure 1**: Multi-chain fork-tree graph topology ($T = (V,E)$) with the Metadata Repository Chain ($C_{\text{repo}}$, Port 8545), Master Patient Index ($C_0$, Port 8546), and autonomous hospital/lab/pharmacy forks ($C_1$--$C_5$) with lineage block heights $\beta_{uv}$.
- **Figure 2**: Hybrid cryptographic storage pipeline displaying AES-256-GCM authenticated encryption for off-chain vaults and SHA-256 integrity anchoring on-chain for GDPR Article 17 / HIPAA compliance.
- **Figure 3**: Cross-fork HL7 FHIR order-fulfillment workflow showing asymmetric request dispatch, repository state machine transitions (`PENDING` $\rightarrow$ `FULFILLED`), and report verification.
