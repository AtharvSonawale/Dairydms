export const tourSteps = {
    '/milkentries': [
        { element: '[data-tour="seller-select"]', popover: { title: 'Select Seller', description: 'Choose the seller for this entry.' } },
        { element: '[data-tour="shift-toggle"]', popover: { title: 'Shift', description: 'Pick morning or evening shift.' } },
        { element: '[data-tour="save-btn"]', popover: { title: 'Save Entry', description: 'Submit the milk entry.' } },
    ],
    '/walkinsales': [
        { element: '[data-tour="buyer-name"]', popover: { title: 'Buyer', description: 'Enter walk-in buyer name.' } },
        { element: '[data-tour="qty-input"]', popover: { title: 'Quantity', description: 'Enter quantity sold.' } },
    ],
    // add one array per route...
};