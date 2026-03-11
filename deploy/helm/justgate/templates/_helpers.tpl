{{/*
Expand the name of the chart.
*/}}
{{- define "justgate.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "justgate.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label.
*/}}
{{- define "justgate.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "justgate.labels" -}}
helm.sh/chart: {{ include "justgate.chart" . }}
{{ include "justgate.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "justgate.selectorLabels" -}}
app.kubernetes.io/name: {{ include "justgate.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Selector labels – backend component (microservice mode).
*/}}
{{- define "justgate.backendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "justgate.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Selector labels – frontend component (microservice mode).
*/}}
{{- define "justgate.frontendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "justgate.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
ServiceAccount name.
*/}}
{{- define "justgate.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "justgate.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Computed database URL.
Priority: explicit .Values.backend.databaseUrl > postgresql subchart > sqlite fallback.
*/}}
{{- define "justgate.databaseUrl" -}}
{{- if .Values.backend.databaseUrl -}}
{{- .Values.backend.databaseUrl -}}
{{- else if .Values.postgresql.enabled -}}
{{- printf "postgresql://%s:%s@%s-postgresql:5432/%s"
    .Values.postgresql.auth.username
    .Values.postgresql.auth.password
    (include "justgate.fullname" .)
    .Values.postgresql.auth.database -}}
{{- else -}}
sqlite:///data/justgate.db
{{- end -}}
{{- end }}

{{/*
Resolve the name of the ConfigMap holding custom CA certificates.
*/}}
{{- define "justgate.caConfigMapName" -}}
{{- if .Values.customCAs.existingConfigMap -}}
{{- .Values.customCAs.existingConfigMap -}}
{{- else -}}
{{- include "justgate.fullname" . }}-ca-certs
{{- end -}}
{{- end }}

{{/*
Render the volume entry for custom CA certificates.
Uses a Secret when existingSecret is set, otherwise a ConfigMap.
*/}}
{{- define "justgate.caVolume" -}}
- name: custom-ca-certs
  {{- if .Values.customCAs.existingSecret }}
  secret:
    secretName: {{ .Values.customCAs.existingSecret }}
    items:
      - key: {{ .Values.customCAs.existingSecretKey | default "ca-bundle.crt" }}
        path: ca-bundle.crt
  {{- else }}
  configMap:
    name: {{ include "justgate.caConfigMapName" . }}
  {{- end }}
{{- end }}

{{/*
Computed backend URL for the frontend.
*/}}
{{- define "justgate.backendUrl" -}}
{{- if .Values.frontend.backendUrl -}}
{{- .Values.frontend.backendUrl -}}
{{- else if eq .Values.mode "monolithic" -}}
http://localhost:{{ .Values.backend.port }}
{{- else -}}
http://{{ include "justgate.fullname" . }}-backend:{{ .Values.backend.port }}
{{- end -}}
{{- end }}

{{/*
Shared backend environment variables (used in both monolithic and microservice deployments).
*/}}
{{- define "justgate.backendEnv" -}}
- name: BACKEND_PORT
  value: {{ .Values.backend.port | quote }}
- name: JUST_GATE_TENANT_HEADER
  value: {{ .Values.backend.tenantHeaderName | quote }}
- name: JUST_GATE_BACKEND_JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "justgate.fullname" . }}-secrets
      key: backendJwtSecret
- name: JUST_GATE_DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "justgate.fullname" . }}-secrets
      key: databaseUrl
{{- end }}

{{/*
Shared frontend environment variables.
*/}}
{{- define "justgate.frontendEnv" -}}
- name: NODE_ENV
  value: production
- name: PORT
  value: {{ .Values.frontend.port | quote }}
- name: HOSTNAME
  value: "0.0.0.0"
- name: NEXTAUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "justgate.fullname" . }}-secrets
      key: nextauthSecret
- name: NEXTAUTH_URL
  value: {{ .Values.frontend.nextauthUrl | quote }}
- name: JUST_GATE_BACKEND_URL
  value: {{ include "justgate.backendUrl" . | quote }}
- name: JUST_GATE_LOCAL_ACCOUNTS_ENABLED
  value: {{ .Values.frontend.localAccountsEnabled | quote }}
- name: JUST_GATE_LOCAL_REGISTRATION_ENABLED
  value: {{ .Values.frontend.localRegistrationEnabled | quote }}
{{- if .Values.customCAs.enabled }}
- name: NODE_EXTRA_CA_CERTS
  value: /etc/ssl/custom-ca/ca-bundle.crt
{{- end }}
{{- if .Values.frontend.oidc.issuer }}
- name: JUST_GATE_OIDC_ISSUER
  value: {{ .Values.frontend.oidc.issuer | quote }}
- name: JUST_GATE_OIDC_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "justgate.fullname" . }}-secrets
      key: oidcClientId
- name: JUST_GATE_OIDC_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "justgate.fullname" . }}-secrets
      key: oidcClientSecret
{{- if .Values.frontend.oidc.name }}
- name: JUST_GATE_OIDC_NAME
  value: {{ .Values.frontend.oidc.name | quote }}
{{- end }}
{{- end }}
{{- end }}
