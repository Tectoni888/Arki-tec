<script>
  import '../app.css';
  import { initializeLocale, locale } from '$lib/i18n';
  import { usarNombresEnEspanol } from '$lib/utils/defaultNames';
  // Plantas y estancias nuevas reciben su nombre por defecto en el idioma elegido.
  locale.subscribe(l => usarNombresEnEspanol(l === 'es'));
  onMount(initializeLocale);
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { themePreference } from '$lib/stores/theme';
  import DeploymentNotice from '$lib/components/DeploymentNotice.svelte';
  // Self-hosted instances and browser tests can run without sending analytics.
  onMount(() => { if (window.location.pathname !== '/render-lab' && env.PUBLIC_ENABLE_ANALYTICS !== 'false') void import('$lib/firebase'); });
  let { children } = $props();
</script>

{@render children()}
<DeploymentNotice />
