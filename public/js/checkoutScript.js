const sanitizeQuotes = (string) => {
    if (typeof string !== 'string') return string;
    return string.replace(/'/g, '"');
}
// Function to Open Modal with address data
function openEditAddressModal(addressId) {
    console.log("iam here when you clicked",addressId)
    const addresses = JSON.parse('<%- JSON.stringify(userAddress) %>');
    const address = addresses.find(addr => addr._id === addressId);

    if (address) {
        document.getElementById("edit_addressType").value = address.addressType || '';
        document.getElementById("edit_name").value = address.name || '';
        document.getElementById("edit_city").value = address.city || '';
        document.getElementById("edit_state").value = address.state || '';
        document.getElementById("edit_landMark").value = address.landMark || '';
        document.getElementById("edit_pincode").value = address.pincode || '';
        document.getElementById("edit_phone").value = address.phone || '';
        document.getElementById("edit_altPhone").value = address.altPhone || '';
        document.getElementById("edit_address_id").value = address._id;
        document.getElementById("editAddressModal").style.display = "flex";
        document.body.style.overflow = 'hidden';
    }
}

function openAddAddressModal(event) {
    if (event) {
        event.preventDefault();
    }
    const modal = document.getElementById("addAddressModal");
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const editModal = document.getElementById("editAddressModal");
    const addModal = document.getElementById("addAddressModal");

    if (editModal) editModal.style.display = "none";
    if (addModal) addModal.style.display = "none";

    document.body.style.overflow = '';
}

// Close modals when clicking outside
window.onclick = function (event) {
    const editModal = document.getElementById("editAddressModal");
    const addModal = document.getElementById("addAddressModal");

    if (event.target === editModal || event.target === addModal) {
        closeModal();
    }
};


document.addEventListener("DOMContentLoaded", function () {
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener("click", async function (e) {
            e.preventDefault();
            alert("button clicked");
            // await placeOrder();
        });
    }
});

// async function placeOrder() {
//     try {
//         const shippingAddress = document.querySelector('input[name="shipping_address"]:checked').value;
//         const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;

//         const sanitizedOrderItems = sanitizeQuotes(`<%- JSON.stringify(cart.items) %>`);
//         const orderedItems = sanitizedOrderItems;

//         let subtotalText = document.getElementById("total").innerText.replace("₹", "").trim();
//         let totalAmount = parseFloat(subtotalText);
//         const couponCode = document.getElementById("couponCode").value.trim();
//         const discountText = document.getElementById("discount").innerText.replace("₹", "").replace("-", "").trim();
//         const discountAmount = parseFloat(discountText) || 0;
//         const appliedCouponCode = currentCouponCode;

//         if (totalAmount <= 0) {
//             Swal.fire({
//                 title: 'Error',
//                 text: 'Your cart is empty or contains invalid items.',
//                 icon: 'error',
//                 confirmButtonText: 'GO TO CART'
//             }).then(() => {
//                 window.location.replace("/cart");
//             });
//             return;
//         }

//         if (orderedItems.includes(undefined)) {
//             Swal.fire({
//                 title: 'Error',
//                 text: 'Please remove all undefined items from your cart before proceeding.',
//                 icon: 'error',
//                 confirmButtonText: 'OK'
//             }).then(() => {
//                 window.location.replace("/cart");
//             });
//             return;
//         }

//         const confirmResult = await Swal.fire({
//             title: 'Confirm Order',
//             text: 'Are you sure you want to place this order?',
//             icon: 'question',
//             showCancelButton: true,
//             confirmButtonColor: '#3085d6',
//             cancelButtonColor: '#d33',
//             confirmButtonText: 'Yes, place order!',
//             cancelButtonText: 'No, cancel'
//         });

//         if (!confirmResult.isConfirmed) return;

//         Swal.fire({
//             title: 'Processing',
//             text: 'Please wait while we process your order...',
//             allowOutsideClick: false,
//             allowEscapeKey: false,
//             showConfirmButton: false,
//             didOpen: () => Swal.showLoading()
//         });

//         if (paymentMethod === "cod") {
//             const response = await fetch("/checkout", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     shippingAddress,
//                     paymentMethod,
//                     totalAmount,
//                     orderedItems,
//                     couponCode: appliedCouponCode,
//                     discountAmount
//                 })
//             });

//             const data = await response.json();
//             if (data.success) {
//                 await Swal.fire({
//                     title: 'Success!',
//                     text: 'Your order has been placed successfully!',
//                     icon: 'success',
//                     timer: 1500,
//                     showConfirmButton: false
//                 });
//                 window.location.href = /viewOrder/`${data.orderId}`;
//             } else {
//                 if (data.unavailableItems && data.unavailableItems.length > 0) {
//                     let unavailableMessage = 'The Some items are no longer available:<br><ul>';
//                     // data.unavailableItems.forEach(item => {
//                     //     unavailableMessage += <li>${item.name}: ${item.reason}</li>;
//                     // });
//                     // unavailableMessage += '</ul>';

//                     Swal.fire({
//                         title: 'Products Unavailable',
//                         html: unavailableMessage,
//                         icon: 'error',
//                         confirmButtonText: 'UPDATE CART'
//                     }).then(() => {
//                         window.location.replace("/cart");
//                     });
//                 } else {
//                     Swal.fire({
//                         title: 'Error!',
//                         text: data.error || 'Failed to place order',
//                         icon: 'error',
//                         confirmButtonText: 'OK'
//                     });
//                 }
//             }
//         } else if (paymentMethod === "razorpay") {
        
//             const validateResponse = await fetch("/validateCheckoutItems", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     orderedItems
//                 })
//             });

//             const validateData = await validateResponse.json();

//             if (!validateData.success) {

//                 if (validateData.unavailableItems && validateData.unavailableItems.length > 0) {
//                     let unavailableMessage = 'The some items are no longer available:<br><ul>';
                    
//                     Swal.fire({
//                         title: 'Products Unavailable',
//                         html: unavailableMessage,
//                         icon: 'error',
//                         confirmButtonText: 'UPDATE CART'
//                     }).then(() => {
//                         window.location.replace("/cart");
//                     });
//                     return;
//                 }
//             }

//             const orderResponse = await fetch("/createOrder", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     amount: totalAmount,
//                     currency: "INR"
//                 })
//             });

//             const orderData = await orderResponse.json();
//             if (!orderData.success) {
//                 throw new Error("Failed to create Razorpay order");
//             }

//             const options = {
//                 key: orderData.key,
//                 amount: orderData.amount,
//                 currency: orderData.currency,
//                 name: "Timeless Aura",
//                 description: "Watch Purchase",
//                 order_id: orderData.order_id,
//                 handler: async function (response) {
//                     try {
//                         const verifyResponse = await fetch("/verifyPayment", {
//                             method: "POST",
//                             headers: { "Content-Type": "application/json" },
//                             body: JSON.stringify({
//                                 razorpay_payment_id: response.razorpay_payment_id,
//                                 razorpay_order_id: response.razorpay_order_id,
//                                 razorpay_signature: response.razorpay_signature,
//                                 shippingAddress,
//                                 orderedItems,
//                                 totalAmount,
//                                 couponCode: appliedCouponCode,
//                                 discountAmount,
//                                 paymentMethod: "razorpay"
//                             })
//                         });

//                         const verifyData = await verifyResponse.json();

//                         if (verifyData.success) {
//                             await Swal.fire({
//                                 title: 'Payment Successful!',
//                                 text: 'Your order has been placed successfully!',
//                                 icon: 'success',
//                                 timer: 1500,
//                                 showConfirmButton: false
//                             });

//                             window.location.href = /viewOrder/`${verifyData.orderId}`;
//                         } else {
//                             if (verifyData.unavailableItems && verifyData.unavailableItems.length > 0) {
//                                 let unavailableMessage = 'Payment successful but some items became unavailable:<br><ul>';
//                                 verifyData.unavailableItems.forEach(item => {
//                                     unavailableMessage += <li>${item.name}: ${item.reason}</li>;
//                                 });
//                                 unavailableMessage += '</ul><br>Your payment will be refunded.';

//                                 Swal.fire({
//                                     title: 'Products Unavailable',
//                                     html: unavailableMessage,
//                                     icon: 'warning',
//                                     confirmButtonText: 'OK'
//                                 }).then(() => {
//                                     window.location.replace("/cart");
//                                 });
//                                 return;
//                             }

//                             throw new Error(verifyData.message || 'Payment verification failed');
//                         }
//                     } catch (error) {
//                         console.error("Payment verification error:", error);
//                         Swal.fire({
//                             title: 'Payment Failed!',
//                             text: error.message || 'Payment verification failed. Please contact support.',
//                             icon: 'error'
//                         });
//                         const failedResponse = await fetch("/verifyPayment", {
//                             method: "POST",
//                             headers: { "Content-Type": "application/json" },
//                             body: JSON.stringify({
//                                 razorpay_order_id: orderData.order_id,
//                                 shippingAddress,
//                                 orderedItems,
//                                 totalAmount,
//                                 couponCode: appliedCouponCode,
//                                 discountAmount,
//                                 paymentMethod: "razorpay",

//                             })
//                         });
//                         const failedData = await failedResponse.json();
//                         if (failedData.orderId) {
//                             window.location.href = /paymentFailed/`${failedData.orderId}`;
//                         }

//                     }
//                 },
//                 modal: {
//                     ondismiss: async function () {
//                         try {
                           
//                             const response = await fetch("/verifyPayment", {
//                                 method: "POST",
//                                 headers: { "Content-Type": "application/json" },
//                                 body: JSON.stringify({
//                                     razorpay_order_id: orderData.order_id,
//                                     shippingAddress,
//                                     orderedItems,
//                                     totalAmount,
//                                     couponCode: appliedCouponCode,
//                                     discountAmount,
//                                     paymentMethod: "razorpay",
//                                     // paymentStatus: "failed"
//                                 })
//                             });
//                             const failedResponse = await response.json();
//                             if (failedResponse.orderId) {
//                                 await Swal.fire({
//                                     title: 'Payment Cancelled',
//                                     text: 'Your payment was cancelled',
//                                     icon: 'warning',
//                                     timer: 1500,
//                                     showConfirmButton: false
//                                 });
//                                 window.location.href = /paymentFailed/`${failedResponse.orderId}`;
//                             }
//                         } catch (error) {
//                             if (failedResponse.orderId) {
//                                 await Swal.fire({
//                                     title: 'Payment Cancelled',
//                                     text: 'Your payment was cancelled',
//                                     icon: 'warning',
//                                     timer: 1500,
//                                     showConfirmButton: false
//                                 });
//                                 window.location.href = /paymentFailed/`${failedResponse.orderId}`;
//                             }
//                             console.error("Failed to handle payment cancellation:", error);
//                             Swal.fire({
//                                 title: 'Error',
//                                 text: 'Something went wrong while cancelling the payment',
//                                 icon: 'error',
//                                 confirmButtonText: 'OK'
//                             });
//                         }
//                     }
//                 },
//                 prefill: {
//                     name: '<%= user.name %>',
//                     email: '<%= user.email %>',
//                     contact: '<%= user.phone %>'
//                 },
//                 theme: { color: "#3399cc" }
//             };

//             const razorpay = new Razorpay(options);
//             razorpay.open();

//         }
//     } catch (error) {
//         console.error('Error:', error);
//         await Swal.fire({
//             title: 'Error!',
//             text: error.message || 'Something went wrong while placing your order.',
//             icon: 'error',
//             confirmButtonText: 'OK'
//         });
//     }
// }


// let currentAppliedCoupon = '';
let currentCouponCode = '';

async function applyCoupons() {
    const couponInputElement = document.getElementById("couponCode");
    const couponCode = couponInputElement.value.trim();
    const subtotalText = document.getElementById("subtotal").innerText.replace("₹", "").trim();
    const subtotal = parseFloat(subtotalText);

    if (!couponCode) {
        document.getElementById("couponMessage").style.color = "red";
        document.getElementById("couponMessage").innerText = "Please enter a coupon code!";
        return;
    }

    try {
        const response = await fetch("/applyCoupon", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                couponCode,
                subtotal
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update UI for applied coupon
            document.getElementById("discount").innerText = `₹${data.discount}`;
            document.getElementById("total").innerText = `₹${data.newTotal + 40}`;
            document.getElementById("couponMessage").style.color = "green";
            document.getElementById("couponMessage").innerText = "Coupon applied successfully!";

            // Show remove coupon section
            document.getElementById("removeCouponSection").style.display = "block";
            document.getElementById("appliedCouponText").innerText = `Applied Coupon: ${couponCode}`;
            currentCouponCode = couponCode;

            // Clear input
            couponInputElement.value = '';

            Swal.fire({
                title: 'Success!',
                text: 'Coupon applied successfully!',
                icon: 'success',
                showConfirmButton: false,
                timer: 1500
            });
        } else {
            document.getElementById("couponMessage").style.color = "red";
            document.getElementById("couponMessage").innerText = data.message;
        }
    } catch (error) {
        console.error("Error applying coupon:", error);
        document.getElementById("couponMessage").style.color = "red";
        document.getElementById("couponMessage").innerText = "An error occurred. Please try again.";
    }
}

async function removeCoupon() {
    try {
        const subtotalText = document.getElementById("subtotal").innerText.replace("₹", "").trim();
        const subtotal = parseFloat(subtotalText);

        const response = await fetch("/removeCoupon", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                couponCode: currentCouponCode,
                subtotal
            })
        });

        const data = await response.json();

        if (data.success) {
            // Reset UI
            document.getElementById("discount").innerText = "₹0";
            document.getElementById("total").innerText = `₹${data.cartTotal+40}`;
            document.getElementById("couponMessage").innerText = "";
            document.getElementById("removeCouponSection").style.display = "none";
            currentCouponCode = '';

            Swal.fire({
                title: 'Coupon Removed',
                text: 'Coupon has been successfully removed',
                icon: 'info',
                showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (error) {
        console.error("Error removing coupon:", error);
        document.getElementById("couponMessage").style.color = "red";
        document.getElementById("couponMessage").innerText = "Error removing coupon. Please try again.";
    }
}

// // Add event listeners when document loads
// document.addEventListener('DOMContentLoaded', function () {
//     const applyCouponBtn = document.getElementById("applyCoupon");
//     const removeCouponBtn = document.getElementById("removeCouponBtn");

//     if (applyCouponBtn) {
//         applyCouponBtn.addEventListener('click', applyCoupons);
//     }

//     if (removeCouponBtn) {
//         removeCouponBtn.addEventListener('click', removeCoupon);
//     }
// });

function copyCoupon(couponId) {

    var couponCodeElement = document.querySelector(`[data-coupon-id="${couponId}"]`);

    if (couponCodeElement) {
        var couponText = couponCodeElement.textContent.trim();

        
        navigator.clipboard.writeText(couponText).then(() => {
            var message = document.getElementById("copy-message-" + couponId);

            console.log(message)

            if (message) {
                message.style.display = "inline";
                setTimeout(() => {
                    
                    message.style.display = "none";
                }, 2000);
            }

            // Optional: Show a sweet alert for better user feedback
            Swal.fire({
                icon: 'success',
                title: 'Coupon Copied!',
                text: `Coupon code ${couponText} has been copied to clipboard`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
        }).catch(err => {
            console.error('Failed to copy: ', err);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Failed to copy coupon code',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
        });
    } else {
        console.error('Coupon code element not found');
    }
}

