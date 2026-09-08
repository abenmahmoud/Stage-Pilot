alter table public.identity_device_sessions
  drop constraint identity_device_sessions_assurance_level_check,
  add constraint identity_device_sessions_assurance_level_check check (
    assurance_level in ('directory_email_otp', 'directory_phone_otp')
  );

comment on column public.identity_device_sessions.assurance_level is
  'Moyen de contact officiel utilisé pour l OTP : email ou téléphone présent dans l annuaire actif.';
