# test/

`mock-supabase.js` is a stand-in for `@supabase/supabase-js` that keeps its
"database" in `localStorage`. It exists so the cloud code path in `js/store.js`
can be exercised without creating a real Supabase project.

To try cloud mode with the fake backend, serve the site over http and set:

```js
window.TEND_CONFIG = {
  SUPABASE_URL: 'https://mock.supabase.test',
  SUPABASE_ANON_KEY: 'mock-anon-key',
  SUPABASE_LIB_URL: '/test/mock-supabase.js',
  ...
};
```

Sign up with any email and password. Nothing leaves the browser. Clear
`mock-supabase:db` in localStorage to reset the fake server.

This directory is not needed in production and can be deleted.
