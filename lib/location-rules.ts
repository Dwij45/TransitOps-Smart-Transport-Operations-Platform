export function coordinateProblems(
  latitude: string,
  longitude: string,
): { path: "latitude" | "longitude"; message: string }[] {
  const problems: { path: "latitude" | "longitude"; message: string }[] = [];

  if ((latitude === "") !== (longitude === "")) {
    problems.push({
      path: "latitude",
      message: "Enter both latitude and longitude, or leave both blank",
    });
    return problems;
  }

  if (latitude && !isCoordinate(latitude, -90, 90)) {
    problems.push({
      path: "latitude",
      message: "Latitude must be between -90 and 90",
    });
  }

  if (longitude && !isCoordinate(longitude, -180, 180)) {
    problems.push({
      path: "longitude",
      message: "Longitude must be between -180 and 180",
    });
  }

  return problems;
}

function isCoordinate(value: string, min: number, max: number) {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) return false;
  const number = Number(value);
  return number >= min && number <= max;
}
