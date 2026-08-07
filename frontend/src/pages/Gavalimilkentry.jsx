import MilkEntryBase from "./MilkEntryBase";

// Milk entry page scoped ONLY to Gavali sellers — sellers list, weight
// scale, and entries table are all filtered to seller_type = 'Gavali'.
export default function GavaliMilkEntry() {
    return <MilkEntryBase sellerType="Gavali" />;
}