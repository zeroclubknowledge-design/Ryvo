/** Session flag: the launch splash has already played in this app window. */
export const SPLASH_SESSION_KEY = "ryvo-splash-shown";

/**
 * Runs in <head> before first paint. In the installed app, for a signed-in
 * player (a Supabase session in storage) on a fresh launch, it sets
 * <html data-splash="in"> so the splash covers the app from the first frame.
 */
export const SPLASH_BOOT = `try{var s=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;var a=Object.keys(localStorage).some(function(k){return /^sb-.+-auth-token$/.test(k)});if(s&&a&&!sessionStorage.getItem('${SPLASH_SESSION_KEY}')){document.documentElement.setAttribute('data-splash','in')}}catch(e){}`;
