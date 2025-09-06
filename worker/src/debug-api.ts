import axios from "axios"

async function debugAPIResponse() {
  try {
    console.log("Debugging API response structure...")
    
    const response = await axios.get("https://api.collectorcrypt.com/marketplace", {
      params: {
        page: 1,
        step: 96,
        cardType: "Card",
        orderBy: "listedDateDesc"
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    })
    
    console.log("Response status:", response.status)
    console.log("Response data keys:", Object.keys(response.data))
    console.log("Response data type:", typeof response.data)
    
    // Check if its an array or object
    if (Array.isArray(response.data)) {
      console.log("Data is array, length:", response.data.length)
      if (response.data.length > 0) {
        console.log("First item keys:", Object.keys(response.data[0]))
      }
    } else if (typeof response.data === "object") {
      console.log("Data is object")
      // Look for nested arrays
      for (const [key, value] of Object.entries(response.data)) {
        if (Array.isArray(value)) {
          console.log(`Found array at key "${key}" with length:`, value.length)
        }
      }
    }
    
    console.log("Raw response structure:")
    console.log(JSON.stringify(response.data, null, 2).substring(0, 1000))
    
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'response' in error && 'message' in error) {
      // @ts-ignore
      console.error("API Error:", error.response?.status, error.message)
    } else {
      console.error("API Error:", error)
    }
  }
}

debugAPIResponse()
