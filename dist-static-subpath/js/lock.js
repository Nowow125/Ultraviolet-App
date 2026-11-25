"use strict";
/**
 * Lock screen: verifies the stored PIN hash, then releases the session.
 */
(() => {
	const lock = Nova.getLock();
	const params = new URLSearchParams(location.search);
	const next = params.get("next") || "/";
	if (!lock || !lock.hash) {
		// no lock configured — nothing to do here
		location.replace(next.startsWith("/") ? next : "/Ultraviolet-App/");
		return;
	}

	const form = document.getElementById("lock-form");
	const pass = document.getElementById("lock-pass");
	const errorEl = document.getElementById("lock-error");
	pass.focus();

	form.addEventListener("submit", (e) => {
		e.preventDefault();
		if (Nova.hash(pass.value) === lock.hash) {
			try {
				sessionStorage.setItem("nova:unlocked", "1");
			} catch {}
			location.replace(next.startsWith("/") ? next : "/");
		} else {
			errorEl.textContent = "Incorrect PIN — try again.";
			pass.value = "";
			pass.focus();
		}
	});

	document.getElementById("lock-forgot").addEventListener("click", () => {
		if (
			!confirm(
				"Reset the lock? This removes the PIN requirement on this device."
			)
		)
			return;
		Nova.store.del("lock");
		try {
			sessionStorage.setItem("nova:unlocked", "1");
		} catch {}
		location.replace("/");
	});
})();
