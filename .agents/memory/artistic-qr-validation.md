---
name: Artistic QR validation
description: How to judge scan reliability of artistic portfolio QR images without mistaking decoder limitations for broken artwork.
---

Verify artistic QR images at their native size and at several realistic reduced display sizes, comparing decoded payloads rather than merely detecting a QR pattern. Use ZXing as the primary reference; a jsQR miss alone is not proof that an artistic image is unreadable.

**Why:** Detailed artwork produced false negatives in jsQR despite consistent ZXing readings. Another image decoded only at one reduced size while failing at its original and most other sizes, so one successful scan would have incorrectly classified it as reliable.

**How to apply:** Test the exact served files after resizing, using a decoder path that never enlarges reduced images. The general `decodeQrImage` helper's jsQR fallback scales small inputs up to 900 px, which can falsely bless artwork that fails at its real display size. Keep only consistently readable examples in a showcase that promises scan reliability, preserving excluded original artwork rather than deleting it. Automated decoding does not establish that a physical print or a particular phone scanner works.
