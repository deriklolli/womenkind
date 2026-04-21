import { relations } from 'drizzle-orm'
import {
  profiles, patients, providers, appointments, appointment_types,
  provider_availability, availability_overrides, visits, encounter_notes,
  intakes, prescriptions, refill_requests, messages, notifications,
  subscriptions, clinics, clinic_providers, clinic_appointment_requests,
  phi_access_log, lab_orders, provider_notes,
  patient_wearable_connections, wearable_metrics, wearable_sync_log,
  care_presentations,
} from './schema'

export const profilesRelations = relations(profiles, ({ one }) => ({
  patients: one(patients, { fields: [profiles.id], references: [patients.profile_id] }),
  providers: one(providers, { fields: [profiles.id], references: [providers.profile_id] }),
}))

export const patientsRelations = relations(patients, ({ one, many }) => ({
  profiles: one(profiles, { fields: [patients.profile_id], references: [profiles.id] }),
  appointments: many(appointments),
  visits: many(visits),
  intakes: many(intakes),
  prescriptions: many(prescriptions),
  refill_requests: many(refill_requests),
  messages: many(messages),
  notifications: many(notifications),
  subscriptions: many(subscriptions),
  lab_orders: many(lab_orders),
  provider_notes: many(provider_notes),
  patient_wearable_connections: many(patient_wearable_connections),
  clinic_appointment_requests: many(clinic_appointment_requests),
  care_presentations: many(care_presentations),
}))

export const providersRelations = relations(providers, ({ one, many }) => ({
  profiles: one(profiles, { fields: [providers.profile_id], references: [profiles.id] }),
  appointments: many(appointments),
  appointment_types: many(appointment_types),
  provider_availability: many(provider_availability),
  availability_overrides: many(availability_overrides),
  clinic_providers: many(clinic_providers),
}))

export const appointmentTypesRelations = relations(appointment_types, ({ one, many }) => ({
  providers: one(providers, { fields: [appointment_types.provider_id], references: [providers.id] }),
  appointments: many(appointments),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  appointment_types: one(appointment_types, {
    fields: [appointments.appointment_type_id],
    references: [appointment_types.id],
  }),
  patients: one(patients, { fields: [appointments.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [appointments.provider_id], references: [providers.id] }),
}))

export const providerAvailabilityRelations = relations(provider_availability, ({ one }) => ({
  providers: one(providers, { fields: [provider_availability.provider_id], references: [providers.id] }),
}))

export const visitsRelations = relations(visits, ({ one }) => ({
  patients: one(patients, { fields: [visits.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [visits.provider_id], references: [providers.id] }),
  appointments: one(appointments, { fields: [visits.appointment_id], references: [appointments.id] }),
}))

export const encounterNotesRelations = relations(encounter_notes, ({ one }) => ({
  patients: one(patients, { fields: [encounter_notes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [encounter_notes.provider_id], references: [providers.id] }),
}))

export const intakesRelations = relations(intakes, ({ one }) => ({
  patients: one(patients, { fields: [intakes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [intakes.provider_id], references: [providers.id] }),
}))

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patients: one(patients, { fields: [prescriptions.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [prescriptions.provider_id], references: [providers.id] }),
  refill_requests: many(refill_requests),
}))

export const refillRequestsRelations = relations(refill_requests, ({ one }) => ({
  prescriptions: one(prescriptions, { fields: [refill_requests.prescription_id], references: [prescriptions.id] }),
  patients: one(patients, { fields: [refill_requests.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [refill_requests.provider_id], references: [providers.id] }),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  patients: one(patients, { fields: [subscriptions.patient_id], references: [patients.id] }),
}))

export const clinicsRelations = relations(clinics, ({ many }) => ({
  clinic_providers: many(clinic_providers),
  clinic_appointment_requests: many(clinic_appointment_requests),
}))

export const clinicProvidersRelations = relations(clinic_providers, ({ one }) => ({
  clinics: one(clinics, { fields: [clinic_providers.clinic_id], references: [clinics.id] }),
  providers: one(providers, { fields: [clinic_providers.provider_id], references: [providers.id] }),
}))

export const clinicAppointmentRequestsRelations = relations(clinic_appointment_requests, ({ one }) => ({
  patients: one(patients, { fields: [clinic_appointment_requests.patient_id], references: [patients.id] }),
  clinics: one(clinics, { fields: [clinic_appointment_requests.clinic_id], references: [clinics.id] }),
}))

export const labOrdersRelations = relations(lab_orders, ({ one }) => ({
  patients: one(patients, { fields: [lab_orders.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [lab_orders.provider_id], references: [providers.id] }),
  visits: one(visits, { fields: [lab_orders.visit_id], references: [visits.id] }),
}))

export const providerNotesRelations = relations(provider_notes, ({ one }) => ({
  patients: one(patients, { fields: [provider_notes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [provider_notes.provider_id], references: [providers.id] }),
}))

export const patientWearableConnectionsRelations = relations(patient_wearable_connections, ({ one, many }) => ({
  patients: one(patients, { fields: [patient_wearable_connections.patient_id], references: [patients.id] }),
  wearable_metrics: many(wearable_metrics),
  wearable_sync_log: many(wearable_sync_log),
}))

export const wearableMetricsRelations = relations(wearable_metrics, ({ one }) => ({
  patients: one(patients, { fields: [wearable_metrics.patient_id], references: [patients.id] }),
  patient_wearable_connections: one(patient_wearable_connections, {
    fields: [wearable_metrics.connection_id],
    references: [patient_wearable_connections.id],
  }),
}))

export const wearableSyncLogRelations = relations(wearable_sync_log, ({ one }) => ({
  patient_wearable_connections: one(patient_wearable_connections, {
    fields: [wearable_sync_log.connection_id],
    references: [patient_wearable_connections.id],
  }),
}))

export const carePresentationsRelations = relations(care_presentations, ({ one }) => ({
  patients: one(patients, { fields: [care_presentations.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [care_presentations.provider_id], references: [providers.id] }),
  intakes: one(intakes, { fields: [care_presentations.intake_id], references: [intakes.id] }),
}))
