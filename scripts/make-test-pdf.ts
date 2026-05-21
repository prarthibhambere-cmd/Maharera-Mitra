import { writeFileSync } from "fs";

// Minimal valid PDF with extractable text. Not pretty but parsable by pdfjs.
const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 322 >>
stream
BT
/F1 12 Tf
72 720 Td
(AGREEMENT FOR SALE) Tj
0 -20 Td
(This Agreement for Sale is executed under Section 13 of) Tj
0 -15 Td
(the RERA Act 2016 between Promoter ABC Developers and) Tj
0 -15 Td
(Allottee XYZ for Flat 502, Tower B, MahaRERA Registration) Tj
0 -15 Td
(Number P51800012345. The total consideration is Rs 75 Lakhs.) Tj
0 -15 Td
(Possession date: 31 December 2027. Quarterly updates per) Tj
0 -15 Td
(MahaRERA Circular 38/2023.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000110 00000 n
0000000210 00000 n
0000000580 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
650
%%EOF`;

const outPath = "test-agreement.pdf";
writeFileSync(outPath, content, "latin1");
console.log(`Wrote ${outPath}`);
