/**
 * Indian PIN (6-digit) → city / state / country via public postal API.
 * Same source as study site configuration & user creation flows.
 *
 * @param {string} pincode
 * @returns {Promise<{ city: string, state: string, country: string } | null>}
 */
export async function fetchIndianPincodeLocation(pincode) {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    return null
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    const data = await response.json()

    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const postOffice = data[0].PostOffice[0]
      return {
        state: postOffice.State || "",
        city: postOffice.District || postOffice.Block || postOffice.Name || "",
        country: postOffice.Country || "India",
      }
    }
    return null
  } catch (e) {
    console.error("fetchIndianPincodeLocation", e)
    return null
  }
}
