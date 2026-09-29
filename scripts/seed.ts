import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import {
  locationType,
  vehicleType,
  location,
  vehicle,
  driver,
  driverLicense,
  safetyEventType,
  driverSafetyEvent,
} from "../db/schema/fleet";
import {
  appSettings,
} from "../db/schema/platform";
import {
  maintenanceServiceType,
  maintenanceOrder,
  maintenanceLineItem,
  expense,
  fuelEntry,
} from "../db/schema/finance";
import {
  trip,
} from "../db/schema/trips";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL is not set in environment.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

// ==========================================
// Deterministic UUID Constants
// ==========================================

// Location Types
const TYPE_DEPOT = "5f8a29a0-bc6f-45b0-8f92-563b78292eb5";
const TYPE_HUB = "1e9a9a3f-1d89-40b5-a35b-d36c1e5fe8e1";
const TYPE_WAREHOUSE = "bc8a3641-789a-41bb-9275-c54d7efd89a9";
const TYPE_CUSTOMER = "41328ae3-6bf2-4da4-874b-ef350c3decf6";
const TYPE_OTHER = "7c4e8a21-6b3d-4f19-8a77-2d91c0e4b615";

// Vehicle Types
const VTYPE_CONTAINER = "aa3e6be2-44a5-4e78-9e6b-7d1ab312cd69";
const VTYPE_TRUCK = "b70c3c3a-9694-4d2c-96b0-13f63116d7a4";
const VTYPE_VAN = "cf2f70db-8d99-4d27-89fb-b9c1e1ad9612";

// Maintenance Service Types
const MTYPE_PREVENTIVE = "65da5a01-4475-408c-bfd5-45eaec722ab0";
const MTYPE_BREAKDOWN = "7ab2d63f-67db-4e12-b2ff-ee1c02a7b8e1";
const MTYPE_INSPECTION = "c7e2fb12-32a2-46be-be11-93c30a84e9d5";
const MTYPE_OIL_SERVICE = "9da5a8f2-2b81-424a-b53d-3df72cd92bc0";

// Safety Event Types
const STYPE_SPEEDING = "c8a2b53a-c8e9-4672-881b-fbdb20adca72";
const STYPE_BRAKING = "ea2f7a93-b67f-4422-bcfa-1db11ae10e01";
const STYPE_ACCIDENT_MINOR = "31fa4a2a-b6f1-4db8-b57f-71ac90adfe81";
const STYPE_ACCIDENT_MAJOR = "9c4b78ae-e5bf-4091-a1e1-12cbe1adfb36";
const STYPE_RED_LIGHT = "ef1e712a-3dfc-4cb6-ab8c-02cf1e6aeb63";
const STYPE_SEATBELT = "5f3d721a-4d7a-42fc-be4f-a2e1c1ad80e0";

// Locations
const LOC_MUMBAI_DEPOT = "d4e5f6a7-0102-0304-0506-0708090a0b0c";
const LOC_PUNE_HUB = "b1c2d3e4-0506-0708-090a-0b0c0d0e0f10";
const LOC_THANE_WAREHOUSE = "c1d2e3f4-0506-0708-090a-0b0c0d0e0f10";
const LOC_CLIENT_A = "d1e2f3a4-0506-0708-090a-0b0c0d0e0f10";
const LOC_CLIENT_B = "e1f2a3b4-0506-0708-090a-0b0c0d0e0f10";

// Vehicles
const VEH_TATA_PRIMA = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
const VEH_BOLERO_PICKUP = "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e";
const VEH_BHARATBENZ = "c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f";
const VEH_OLD_VAN = "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a";

// Drivers
const DRV_RAJESH = "f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const DRV_AMIT = "a1b2c3d4-f5e6-7a8b-9c0d-1e2f3a4b5c6d";
const DRV_VIKRAM = "b1c2d3e4-a5f6-7b8c-9d0e-1f2a3b4c5d6e";
const DRV_SUNIL = "c1d2e3f4-b5a6-7c8d-9e0f-1a2b3c4d5e6f";

// Licenses
const LIC_RAJESH = "a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d";
const LIC_AMIT = "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e";
const LIC_VIKRAM = "c2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e";
const LIC_SUNIL = "d2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e";

// Safety Events
const SE_SPEEDING = "f51a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const SE_BRAKING = "f52b3c4d-e6f7-8a9b-0c1d-2e3f4a5b6c7d";

// Trips
const TRIP_1 = "f61a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const TRIP_2 = "f62b3c4d-e6f7-8a9b-0c1d-2e3f4a5b6c7d";
const TRIP_3 = "f63c4d5e-f7a8-8b9c-0d1e-2f3a4b5c6d7e";
const TRIP_4 = "f64d5e6f-a8b9-8c9d-0e1f-2a3b4c5d6e7f";
const TRIP_5 = "f65e6f7a-b9c0-8d9e-0f1a-2b3c4d5e6f7a";

// Maintenance Orders
const MO_1 = "f71a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const MO_2 = "f72b3c4d-e6f7-8a9b-0c1d-2e3f4a5b6c7d";
const MO_3 = "f73c4d5e-f7a8-8b9c-0d1e-2f3a4b5c6d7e";

// Expenses
const EXP_MAINTENANCE_1 = "f81a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const EXP_FUEL_1 = "f82b3c4d-e6f7-8a9b-0c1d-2e3f4a5b6c7d";
const EXP_TOLL_1 = "f83c4d5e-f7a8-8b9c-0d1e-2f3a4b5c6d7e";

// Line Items
const LI_1 = "f91a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
const LI_2 = "f92b3c4d-e6f7-8a9b-0c1d-2e3f4a5b6c7d";

// Fuel Entry
const FE_1 = "fa1a2b3c-d5e6-7f8a-9b0c-1d2e3f4a5b6c";

// ==========================================
// Seed Function
// ==========================================

async function main() {
  console.log("Starting database seed...");

  try {
    await db.transaction(async (tx) => {
      // 1. Seed Location Types
      console.log("Seeding location types...");
      await tx
        .insert(locationType)
        .values([
          { id: TYPE_DEPOT, name: "Depot" },
          { id: TYPE_HUB, name: "Hub" },
          { id: TYPE_WAREHOUSE, name: "Warehouse" },
          { id: TYPE_CUSTOMER, name: "Customer" },
          { id: TYPE_OTHER, name: "Other" },
        ])
        .onConflictDoNothing();

      // 2. Seed Vehicle Types
      console.log("Seeding vehicle types...");
      await tx
        .insert(vehicleType)
        .values([
          { id: VTYPE_CONTAINER, name: "Container Truck", description: "Large heavy freight container truck" },
          { id: VTYPE_TRUCK, name: "Truck", description: "Standard flatbed or box cargo truck" },
          { id: VTYPE_VAN, name: "Van", description: "Light goods delivery commercial van" },
        ])
        .onConflictDoNothing();

      // 3. Seed Maintenance Service Types
      console.log("Seeding maintenance service types...");
      await tx
        .insert(maintenanceServiceType)
        .values([
          { id: MTYPE_PREVENTIVE, name: "Preventive Maintenance", description: "Scheduled regular inspections and wear replacements" },
          { id: MTYPE_BREAKDOWN, name: "Breakdown Repair", description: "Unscheduled repair due to vehicle failure" },
          { id: MTYPE_INSPECTION, name: "Routine Inspection", description: "Standard safety and operational checks" },
          { id: MTYPE_OIL_SERVICE, name: "Oil & Filter Service", description: "Engine oil and filter change" },
        ])
        .onConflictDoNothing();

      // 4. Seed Safety Event Types
      console.log("Seeding safety event types...");
      await tx
        .insert(safetyEventType)
        .values([
          { id: STYPE_SPEEDING, name: "Speeding", defaultPoints: "-2.00" },
          { id: STYPE_BRAKING, name: "Harsh Braking", defaultPoints: "-1.00" },
          { id: STYPE_ACCIDENT_MINOR, name: "Accident (Minor)", defaultPoints: "-5.00" },
          { id: STYPE_ACCIDENT_MAJOR, name: "Accident (Major)", defaultPoints: "-10.00" },
          { id: STYPE_RED_LIGHT, name: "Red Light Violation", defaultPoints: "-3.00" },
          { id: STYPE_SEATBELT, name: "Seatbelt Violation", defaultPoints: "-1.00" },
        ])
        .onConflictDoNothing();

      // 5. Seed Locations (including Default Depot)
      console.log("Seeding locations...");
      await tx
        .insert(location)
        .values([
          {
            id: LOC_MUMBAI_DEPOT,
            typeId: TYPE_DEPOT,
            name: "Mumbai Central Depot",
            addressLine1: "100 Depot Road",
            addressLine2: "Mumbai Central",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400008",
            countryCode: "IN",
            latitude: "18.969600",
            longitude: "72.819400",
          },
          {
            id: LOC_PUNE_HUB,
            typeId: TYPE_HUB,
            name: "Pune Logistics Hub",
            addressLine1: "Plot 42, Hinjewadi Phase 3",
            city: "Pune",
            state: "Maharashtra",
            postalCode: "411057",
            countryCode: "IN",
            latitude: "18.591300",
            longitude: "73.717900",
          },
          {
            id: LOC_THANE_WAREHOUSE,
            typeId: TYPE_WAREHOUSE,
            name: "Thane Warehouse",
            addressLine1: "Wagle Estate, Road 16",
            city: "Thane",
            state: "Maharashtra",
            postalCode: "400604",
            countryCode: "IN",
            latitude: "19.198300",
            longitude: "72.952500",
          },
          {
            id: LOC_CLIENT_A,
            typeId: TYPE_CUSTOMER,
            name: "Client Location A (Andheri)",
            addressLine1: "Tech Park, Andheri East",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400069",
            countryCode: "IN",
            latitude: "19.113600",
            longitude: "72.869800",
          },
          {
            id: LOC_CLIENT_B,
            typeId: TYPE_CUSTOMER,
            name: "Client Location B (Chakan)",
            addressLine1: "Industrial Area, Chakan",
            city: "Pune",
            state: "Maharashtra",
            postalCode: "410501",
            countryCode: "IN",
            latitude: "18.784400",
            longitude: "73.858300",
          },
        ])
        .onConflictDoNothing();

      // 6. Seed App Settings (Singleton ID = 1)
      console.log("Seeding app settings...");
      await tx
        .insert(appSettings)
        .values({
          id: 1,
          operatorName: "TransitOps India",
          defaultDepotId: LOC_MUMBAI_DEPOT,
          currency: "INR",
          timezone: "Asia/Kolkata",
          distanceUnit: "kilometre",
          weightUnit: "kilogram",
        })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: {
            operatorName: "TransitOps India",
            defaultDepotId: LOC_MUMBAI_DEPOT,
            currency: "INR",
            timezone: "Asia/Kolkata",
            distanceUnit: "kilometre",
            weightUnit: "kilogram",
          },
        });

      // 7. Seed Vehicles
      console.log("Seeding vehicles...");
      await tx
        .insert(vehicle)
        .values([
          {
            id: VEH_TATA_PRIMA,
            registrationNumber: "MH-12-PQ-1234",
            fleetNumber: "FLT-001",
            name: "Tata Prima Container",
            model: "Prima 4025.S",
            manufacturer: "Tata",
            typeId: VTYPE_CONTAINER,
            capacityKg: "25000.00",
            currentOdometerKm: "12000.50",
            acquisitionCostMinor: BigInt(420000000), // 4.2M INR
            acquisitionCurrency: "INR",
            acquiredOn: new Date("2025-01-10"),
            lifecycle: "active",
          },
          {
            id: VEH_BOLERO_PICKUP,
            registrationNumber: "MH-02-AB-5678",
            fleetNumber: "FLT-002",
            name: "Bolero Pickup",
            model: "Bolero",
            manufacturer: "Mahindra",
            typeId: VTYPE_VAN,
            capacityKg: "1500.00",
            currentOdometerKm: "45000.00",
            acquisitionCostMinor: BigInt(90000000), // 900k INR
            acquisitionCurrency: "INR",
            acquiredOn: new Date("2024-05-15"),
            lifecycle: "in_shop",
          },
          {
            id: VEH_BHARATBENZ,
            registrationNumber: "MH-14-XY-9012",
            fleetNumber: "FLT-003",
            name: "BharatBenz Cargo",
            model: "1917R",
            manufacturer: "BharatBenz",
            typeId: VTYPE_TRUCK,
            capacityKg: "10000.00",
            currentOdometerKm: "8000.00",
            acquisitionCostMinor: BigInt(280000000), // 2.8M INR
            acquisitionCurrency: "INR",
            acquiredOn: new Date("2025-03-01"),
            lifecycle: "active",
          },
          {
            id: VEH_OLD_VAN,
            registrationNumber: "MH-43-ZZ-9999",
            fleetNumber: "FLT-004",
            name: "Old Delivery Van",
            model: "Maxx",
            manufacturer: "Mahindra",
            typeId: VTYPE_VAN,
            capacityKg: "1200.00",
            currentOdometerKm: "150000.00",
            acquisitionCostMinor: BigInt(60000000), // 600k INR
            acquisitionCurrency: "INR",
            acquiredOn: new Date("2018-02-10"),
            lifecycle: "retired",
            retiredAt: new Date("2026-06-01T12:00:00Z"),
          },
        ])
        .onConflictDoNothing();

      // 8. Seed Drivers
      console.log("Seeding drivers...");
      await tx
        .insert(driver)
        .values([
          {
            id: DRV_RAJESH,
            employeeCode: "EMP001",
            name: "Rajesh Kumar",
            phone: "+919876543210",
            email: "rajesh.kumar@transitops.com",
            dutyState: "on_duty",
            hiredOn: new Date("2023-04-01"),
          },
          {
            id: DRV_AMIT,
            employeeCode: "EMP002",
            name: "Amit Singh",
            phone: "+919876543211",
            email: "amit.singh@transitops.com",
            dutyState: "off_duty",
            hiredOn: new Date("2024-06-15"),
          },
          {
            id: DRV_VIKRAM,
            employeeCode: "EMP003",
            name: "Vikram Patel",
            phone: "+919876543212",
            email: "vikram.patel@transitops.com",
            dutyState: "suspended",
            hiredOn: new Date("2022-09-10"),
          },
          {
            id: DRV_SUNIL,
            employeeCode: "EMP004",
            name: "Sunil Yadav",
            phone: "+919876543213",
            email: "sunil.yadav@transitops.com",
            dutyState: "on_duty",
            hiredOn: new Date("2025-01-05"),
          },
        ])
        .onConflictDoNothing();

      // 9. Seed Driver Licenses
      console.log("Seeding driver licenses...");
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      await tx
        .insert(driverLicense)
        .values([
          {
            id: LIC_RAJESH,
            driverId: DRV_RAJESH,
            licenseNumber: "lic-1111-2222-3333",
            category: "Heavy Goods Vehicle",
            issuedOn: new Date("2023-01-01"),
            expiresOn: new Date("2027-01-01"),
            isPrimary: true,
            verifiedAt: new Date("2023-04-01T10:00:00Z"),
          },
          {
            id: LIC_AMIT,
            driverId: DRV_AMIT,
            licenseNumber: "lic-4444-5555-6666",
            category: "Light Goods Vehicle",
            issuedOn: new Date("2024-06-01"),
            expiresOn: new Date("2028-06-01"),
            isPrimary: true,
            verifiedAt: new Date("2024-06-15T11:00:00Z"),
          },
          {
            id: LIC_VIKRAM,
            driverId: DRV_VIKRAM,
            licenseNumber: "lic-7777-8888-9999",
            category: "Heavy Goods Vehicle",
            issuedOn: new Date("2020-09-01"),
            expiresOn: new Date("2025-09-01"), // Expired license
            isPrimary: true,
            verifiedAt: new Date("2022-09-10T09:00:00Z"),
          },
          {
            id: LIC_SUNIL,
            driverId: DRV_SUNIL,
            licenseNumber: "lic-1212-3434-5656",
            category: "Heavy Goods Vehicle",
            issuedOn: new Date("2022-08-15"),
            expiresOn: oneMonthFromNow, // Expiring soon
            isPrimary: true,
            verifiedAt: new Date("2025-01-05T09:00:00Z"),
          },
        ])
        .onConflictDoNothing();

      // 10. Seed Driver Safety Events
      console.log("Seeding driver safety events...");
      await tx
        .insert(driverSafetyEvent)
        .values([
          {
            id: SE_SPEEDING,
            driverId: DRV_RAJESH,
            eventTypeId: STYPE_SPEEDING,
            severity: "medium",
            occurredAt: new Date("2026-05-10T14:30:00Z"),
            pointsApplied: "-2.00",
            summary: "Speeding on NH4 highway",
            notes: "Captured by GPS speed logs - going 95 km/h in an 80 km/h speed limit zone.",
          },
          {
            id: SE_BRAKING,
            driverId: DRV_RAJESH,
            eventTypeId: STYPE_BRAKING,
            severity: "low",
            occurredAt: new Date("2026-06-12T10:15:00Z"),
            pointsApplied: "-1.00",
            summary: "Harsh braking event detected",
            notes: "Sudden deceleration of 12 km/h per second triggered alert.",
          },
        ])
        .onConflictDoNothing();

      // 11. Seed Trips
      console.log("Seeding trips...");
      await tx
        .insert(trip)
        .values([
          {
            id: TRIP_1,
            code: "TR000001",
            status: "completed",
            originLocationId: LOC_MUMBAI_DEPOT,
            destinationLocationId: LOC_PUNE_HUB,
            vehicleId: VEH_TATA_PRIMA,
            driverId: DRV_RAJESH,
            cargoWeightKg: "18000.00",
            plannedDistanceKm: "150.00",
            startOdometerKm: "11000.00",
            endOdometerKm: "11152.50",
            scheduledStartAt: new Date("2026-07-01T08:00:00Z"),
            scheduledEndAt: new Date("2026-07-01T12:00:00Z"),
            actualStartAt: new Date("2026-07-01T08:15:00Z"),
            actualEndAt: new Date("2026-07-01T12:30:00Z"),
            quotedRevenueMinor: BigInt(4500000), // 45k INR
            finalRevenueMinor: BigInt(4500000),
            currency: "INR",
            customerName: "Pune Distributing Co.",
            externalReference: "REF-998877",
            notes: "Trip completed on schedule. Toll route taken.",
          },
          {
            id: TRIP_2,
            code: "TR000002",
            status: "in_progress",
            originLocationId: LOC_THANE_WAREHOUSE,
            destinationLocationId: LOC_CLIENT_B,
            vehicleId: VEH_BHARATBENZ,
            driverId: DRV_SUNIL,
            cargoWeightKg: "8500.00",
            plannedDistanceKm: "120.00",
            startOdometerKm: "7880.00",
            scheduledStartAt: new Date("2026-07-12T09:00:00Z"),
            scheduledEndAt: new Date("2026-07-12T13:00:00Z"),
            actualStartAt: new Date("2026-07-12T09:10:00Z"),
            quotedRevenueMinor: BigInt(3000000), // 30k INR
            currency: "INR",
            customerName: "Chakan Manufacturing",
            externalReference: "PO-3344",
            notes: "En route to Pune.",
          },
          {
            id: TRIP_3,
            code: "TR000003",
            status: "dispatched",
            originLocationId: LOC_MUMBAI_DEPOT,
            destinationLocationId: LOC_CLIENT_A,
            vehicleId: VEH_TATA_PRIMA,
            driverId: DRV_RAJESH,
            cargoWeightKg: "12000.00",
            plannedDistanceKm: "40.00",
            scheduledStartAt: new Date("2026-07-13T10:00:00Z"),
            scheduledEndAt: new Date("2026-07-13T12:00:00Z"),
            quotedRevenueMinor: BigInt(1500000), // 15k INR
            currency: "INR",
            customerName: "Andheri Retailers",
            externalReference: "PO-3345",
            notes: "Scheduled for tomorrow.",
          },
          {
            id: TRIP_4,
            code: "TR000004",
            status: "draft",
            originLocationId: LOC_PUNE_HUB,
            destinationLocationId: LOC_THANE_WAREHOUSE,
            cargoWeightKg: "5000.00",
            plannedDistanceKm: "130.00",
            scheduledStartAt: new Date("2026-07-14T14:00:00Z"),
            scheduledEndAt: new Date("2026-07-14T18:00:00Z"),
            quotedRevenueMinor: BigInt(2800000), // 28k INR
            currency: "INR",
            customerName: "Thane Storage Ltd",
            externalReference: "REF-0012",
            notes: "Needs driver and vehicle assignment.",
          },
          {
            id: TRIP_5,
            code: "TR000005",
            status: "cancelled",
            originLocationId: LOC_CLIENT_A,
            destinationLocationId: LOC_MUMBAI_DEPOT,
            cargoWeightKg: "3000.00",
            plannedDistanceKm: "40.00",
            scheduledStartAt: new Date("2026-07-10T10:00:00Z"),
            scheduledEndAt: new Date("2026-07-10T12:00:00Z"),
            currency: "INR",
            customerName: "Andheri Retailers",
            notes: "Cancelled due to customer order revision.",
            cancellationReason: "Customer request",
          },
        ])
        .onConflictDoNothing();

      // 12. Seed Maintenance Orders
      console.log("Seeding maintenance orders...");
      await tx
        .insert(maintenanceOrder)
        .values([
          {
            id: MO_1,
            code: "MO000001",
            vehicleId: VEH_TATA_PRIMA,
            serviceTypeId: MTYPE_PREVENTIVE,
            status: "completed",
            scheduledAt: new Date("2026-06-25T09:00:00Z"),
            startedAt: new Date("2026-06-25T09:15:00Z"),
            completedAt: new Date("2026-06-25T15:30:00Z"),
            openingOdometerKm: "10800.00",
            closingOdometerKm: "10800.00",
            vendorName: "Tata Motors Service",
            notes: "Routine 10k preventive service. Changed oil, filter, and checked tire pressure.",
          },
          {
            id: MO_2,
            code: "MO000002",
            vehicleId: VEH_BOLERO_PICKUP,
            serviceTypeId: MTYPE_BREAKDOWN,
            status: "in_progress",
            scheduledAt: new Date("2026-07-10T08:00:00Z"),
            startedAt: new Date("2026-07-10T08:30:00Z"),
            openingOdometerKm: "45000.00",
            vendorName: "Metro Garage Thane",
            notes: "Engine overheating. Diagnostic check in progress.",
          },
          {
            id: MO_3,
            code: "MO000003",
            vehicleId: VEH_BHARATBENZ,
            serviceTypeId: MTYPE_INSPECTION,
            status: "scheduled",
            scheduledAt: new Date("2026-07-20T09:00:00Z"),
            vendorName: "BharatBenz Service",
            notes: "Scheduled 10k inspection.",
          },
        ])
        .onConflictDoNothing();

      // 13. Seed Maintenance Order Line Items
      console.log("Seeding maintenance line items...");
      await tx
        .insert(maintenanceLineItem)
        .values([
          {
            id: LI_1,
            maintenanceOrderId: MO_1,
            kind: "part",
            description: "Engine Oil & Filter replacement",
            quantity: "1.000",
            unitAmountMinor: BigInt(150000), // 1,500 INR
            currency: "INR",
          },
          {
            id: LI_2,
            maintenanceOrderId: MO_1,
            kind: "labour",
            description: "Labour charges",
            quantity: "1.000",
            unitAmountMinor: BigInt(50000), // 500 INR
            currency: "INR",
          },
        ])
        .onConflictDoNothing();

      // 14. Seed Expenses (linked to completed maintenance order, fuel entry, and toll)
      console.log("Seeding expenses...");
      await tx
        .insert(expense)
        .values([
          {
            id: EXP_MAINTENANCE_1,
            kind: "maintenance",
            amountMinor: BigInt(200000), // 2,000 INR (Matches lines item total)
            currency: "INR",
            incurredAt: new Date("2026-06-25T15:30:00Z"),
            vehicleId: VEH_TATA_PRIMA,
            maintenanceOrderId: MO_1,
            vendorName: "Tata Motors Service",
            description: "Preventive 10k Service (Oil & Filter)",
          },
          {
            id: EXP_FUEL_1,
            kind: "fuel",
            amountMinor: BigInt(450000), // 4,500 INR
            currency: "INR",
            incurredAt: new Date("2026-07-05T10:15:00Z"),
            vehicleId: VEH_TATA_PRIMA,
            description: "Diesel refill 50L",
            vendorName: "HP Fuel Station",
          },
          {
            id: EXP_TOLL_1,
            kind: "toll",
            amountMinor: BigInt(25000), // 250 INR
            currency: "INR",
            incurredAt: new Date("2026-07-01T09:30:00Z"),
            vehicleId: VEH_TATA_PRIMA,
            tripId: TRIP_1,
            description: "NH4 Highway Toll",
            vendorName: "NHAI FASTag",
          },
        ])
        .onConflictDoNothing();

      // 15. Seed Fuel Entry (linked to fuel expense)
      console.log("Seeding fuel entries...");
      await tx
        .insert(fuelEntry)
        .values({
          id: FE_1,
          expenseId: EXP_FUEL_1,
          litres: "50.000",
          odometerKm: "11800.00",
          fuelType: "diesel",
        })
        .onConflictDoNothing();

      // 16. Advance database sequences so future creations don't conflict
      console.log("Advancing database sequences...");
      await tx.execute(sql`select setval('trip_code_sequence', 5)`);
      await tx.execute(sql`select setval('maintenance_order_code_sequence', 3)`);
    });

    console.log("Database seeded successfully!");
  } catch (err) {
    console.error("Error seeding database:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Unhandled error during seeding:", err);
  process.exit(1);
});
