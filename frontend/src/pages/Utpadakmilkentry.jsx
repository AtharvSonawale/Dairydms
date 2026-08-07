import MilkEntryBase from "./MilkEntryBase";

// Milk entry page scoped ONLY to Utpadak sellers — sellers list, weight
// scale, and entries table are all filtered to seller_type = 'Utpadak'.
export default function UtpadakMilkEntry() {
    return <MilkEntryBase sellerType="Utpadak" />;
}