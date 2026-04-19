def celsius_to_fahrenheit(c):
    return c * 9 / 5 + 32


def classify_temp(f):
    if f < 32:
        return "freezing"
    elif f < 60:
        return "cold"
    elif f < 80:
        return "comfortable"
    else:
        return "hot"


if __name__ == "__main__":
    celsius = float(input("Enter temperature in Celsius: "))
    fahrenheit = celsius_to_fahrenheit(celsius)
    print(f"{celsius}°C = {fahrenheit}°F")
    print(f"Classification: {classify_temp(fahrenheit)}")
