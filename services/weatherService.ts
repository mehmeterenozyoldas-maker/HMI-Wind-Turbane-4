
export interface WeatherData {
  city: string;
  temp: number;
  windSpeed: number; // m/s
  windDeg: number; // degrees
  clouds: number; // %
  condition: string;
  isReal: boolean;
}

const API_KEY = process.env.OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_KEY'; // In a real app, use env vars

// Mock data generator for fallback
const generateMockWeather = (): WeatherData => ({
  city: "Simulation City",
  temp: 15 + Math.random() * 10,
  windSpeed: 5 + Math.random() * 15, // 5 to 20 m/s
  windDeg: Math.random() * 360,
  clouds: Math.random() * 100,
  condition: "Simulated",
  isReal: false
});

export const fetchWeatherData = async (city: string = "San Francisco"): Promise<WeatherData> => {
  if (!API_KEY || API_KEY === 'YOUR_OPENWEATHER_KEY') {
    console.warn("No OpenWeatherMap API Key found. Using simulation data.");
    return generateMockWeather();
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error("Weather API Error");
    }

    const data = await response.json();

    return {
      city: data.name,
      temp: data.main.temp,
      windSpeed: data.wind.speed,
      windDeg: data.wind.deg,
      clouds: data.clouds.all,
      condition: data.weather[0].main,
      isReal: true
    };
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    return generateMockWeather();
  }
};
