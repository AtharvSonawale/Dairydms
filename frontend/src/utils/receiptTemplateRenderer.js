// src/utils/receiptTemplateRenderer.js
import { getReceiptTemplate } from "./receiptTemplate";
import { getCentreName } from "./centreName";

// Builds the header block HTML given the saved template + live values.
// Used by every receipt printer (cattle feed, product, and future ones).
export const renderReceiptHeader = ({ appName, centreName, transactionId, t }) => {
    const tpl = getReceiptTemplate();
    const resolvedCentreName = tpl.centreNameOverride?.trim() || centreName || getCentreName() || "";

    return `
    <div class="header">
      ${tpl.showTopSymbol ? `<div class="shri">${tpl.topSymbolText}</div>` : ""}
      ${tpl.showAppName ? `<div class="app-name">${appName}</div>` : ""}
      ${tpl.showCentreName && resolvedCentreName ? `<div class="center-name">${resolvedCentreName}</div>` : ""}
    </div>
    ${tpl.showTransactionId ? `
      <div class="transaction-id">
        ${tpl.transactionIdLabel}: ${transactionId}
      </div>
    ` : ""}
  `;
};

// Builds the footer + signature block.
export const renderReceiptFooter = () => {
    const tpl = getReceiptTemplate();
    return `
    <div class="footer">
      <span class="left">${tpl.footerText}</span>
      ${tpl.showGst ? `<span class="right">${tpl.gstText}</span>` : ""}
    </div>
    ${tpl.showSignatory ? `
      <div class="signature">
        ${tpl.signatoryText}
      </div>
    ` : ""}
  `;
};

// Whether the date/time row and seller code should render — pulled from
// the same template so both live in one place.
export const receiptShowsDateTime = () => getReceiptTemplate().showDateTime;
export const receiptShowsSellerCode = () => getReceiptTemplate().showSellerCode;