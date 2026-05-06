import { useEffect, useRef } from "react";

interface Props {
  buttonId: string;
}

/**
 * Renders a Razorpay Payment Button embed.
 * The script must be appended to a <form> element on mount.
 */
const RazorpayButton = ({ buttonId }: Props) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || form.querySelector("script")) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/payment-button.js";
    script.async = true;
    script.dataset.payment_button_id = buttonId;
    form.appendChild(script);
  }, [buttonId]);

  return (
    <form
      ref={formRef}
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex justify-center"
    />
  );
};

export default RazorpayButton;
