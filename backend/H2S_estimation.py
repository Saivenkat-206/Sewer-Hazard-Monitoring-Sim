import math


# Reconstructed risk multipliers.
# These are approximations, not recovered original coefficients.
RISK_MULTIPLIERS = {
    "Safe": 1.00,
    "Warning": 1.15,
    "High Risk": 1.35,
    "Critical": 1.60,
}

# Baseline proxy weights.
# Tune these only against independently validated reference data.
WEIGHTS = {
    "methane": 0.40,
    "air_quality": 0.35,
    "temperature": 0.15,
    "humidity": 0.10,
}

# Normalisation references based on the project's sensor ranges.
NORMALISATION = {
    "methane": 1000.0,
    "air_quality": 600.0,
    "temperature": 50.0,
    "humidity": 100.0,
}

# Output bounds for the relative proxy index.
MIN_ESTIMATE = 0.0
MAX_ESTIMATE = 100.0


def _normalise(value, reference):
    """Normalise a sensor value to a 0-1 range."""
    value = float(value)
    return max(0.0, min(value / reference, 1.0))


def calculate_h2s_estimate(
    methane,
    air_quality,
    temperature,
    humidity,
    risk
):
    # Convert and validate inputs.
    try:
        methane = float(methane)
        air_quality = float(air_quality)
        temperature = float(temperature)
        humidity = float(humidity)
    except (TypeError, ValueError):
        raise ValueError("All sensor readings must be numeric.")

    readings = [methane, air_quality, temperature, humidity]

    if not all(math.isfinite(x) for x in readings):
        raise ValueError("Sensor readings must be finite numbers.")

    # Normalise sensor readings.
    methane_n = _normalise(
        methane, NORMALISATION["methane"]
    )
    air_quality_n = _normalise(
        air_quality, NORMALISATION["air_quality"]
    )
    temperature_n = _normalise(
        temperature, NORMALISATION["temperature"]
    )
    humidity_n = _normalise(
        humidity, NORMALISATION["humidity"]
    )

    # Calculate baseline proxy.
    baseline = (
        methane_n * WEIGHTS["methane"]
        + air_quality_n * WEIGHTS["air_quality"]
        + temperature_n * WEIGHTS["temperature"]
        + humidity_n * WEIGHTS["humidity"]
    )

    # Apply risk-dependent adjustment.
    risk_key = str(risk).strip().lower()

    risk_lookup = {
        key.lower(): value
        for key, value in RISK_MULTIPLIERS.items()
    }

    multiplier = risk_lookup.get(risk_key, 1.0)

    estimate = baseline * 100.0 * multiplier

    # Bound the output.
    estimate = max(
        MIN_ESTIMATE,
        min(estimate, MAX_ESTIMATE)
    )

    return {
        "estimated_h2s": round(estimate, 2),
        "risk": risk,
        "risk_multiplier": multiplier,
        "unit": "relative_index",
        "is_calibrated": False,
    }


def predict_risk(methane, air_quality, temperature, humidity):
    # Methane contribution.
    if methane > 2000:
        score += 3
    elif methane > 1000:
        score += 2
    elif methane > 500:
        score += 1

    # Air quality contribution.
    if air_quality > 600:
        score += 3
    elif air_quality > 350:
        score += 2
    elif air_quality > 200:
        score += 1

    # Temperature contribution.
    if temperature > 45:
        score += 2
    elif temperature > 35:
        score += 1

    # Humidity contribution.
    if humidity > 95:
        score += 2
    elif humidity > 80:
        score += 1

    if score <= 1:
        return "Safe"
    elif score <= 3:
        return "Warning"
    elif score <= 5:
        return "High Risk"
    else:
        return "Critical"


if __name__ == "__main__":
    # Quick standalone test.
    methane = 234
    air_quality = 220
    temperature = 33.1
    humidity = 64.7

    risk = predict_risk(
        methane,
        air_quality,
        temperature,
        humidity
    )

    result = calculate_h2s_estimate(
        methane,
        air_quality,
        temperature,
        humidity,
        risk
    )

    print("Risk:", risk)
    print("H2S proxy:", result)
