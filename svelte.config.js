import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';

// En Vercel (variable VERCEL=1) se genera la salida que Vercel espera; en
// cualquier otro sitio se mantiene el servidor Node original.
const adapter = process.env.VERCEL ? vercelAdapter() : nodeAdapter();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter
	}
};

export default config;
