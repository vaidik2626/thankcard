import type { CardLayout } from "@/lib/card/layout";
import { SectionPrimitives } from "./primitives";

type Props = { layout: CardLayout };

/** Section 1–2: optional logo, "Thank you so much for choosing", script brand name. */
export function BrandHeader({ layout }: Props) {
  return (
    <g data-component="BrandHeader">
      <SectionPrimitives name="logo" section={layout.sections.logo} />
      <SectionPrimitives name="heading" section={layout.sections.heading} />
      <SectionPrimitives name="brand" section={layout.sections.brand} />
    </g>
  );
}

/** Section 3: intro line and the boxed, underlined product name. */
export function ProductSection({ layout }: Props) {
  return (
    <g data-component="ProductSection">
      <SectionPrimitives name="intro" section={layout.sections.intro} />
      <SectionPrimitives name="product" section={layout.sections.product} />
    </g>
  );
}

/** Section 4: review request copy with bold phrases. */
export function ReviewMessage({ layout }: Props) {
  return (
    <g data-component="ReviewMessage">
      <SectionPrimitives name="message" section={layout.sections.message} />
    </g>
  );
}

/** Section 5: review + feedback QR codes side by side with labels. */
export function QRCodeSection({ layout }: Props) {
  return (
    <g data-component="QRCodeSection">
      <SectionPrimitives name="qr" section={layout.sections.qr} />
    </g>
  );
}

/** Section 6: WhatsApp support copy and boxed contact number. */
export function WhatsAppSection({ layout }: Props) {
  return (
    <g data-component="WhatsAppSection">
      <SectionPrimitives name="whatsapp" section={layout.sections.whatsapp} />
      <SectionPrimitives name="contact" section={layout.sections.contact} />
    </g>
  );
}

/** Section 7: "Best, <Business Name>". */
export function BusinessSignature({ layout }: Props) {
  return (
    <g data-component="BusinessSignature">
      <SectionPrimitives name="signature" section={layout.sections.signature} />
    </g>
  );
}
