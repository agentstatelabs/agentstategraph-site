// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://agentstategraph.dev',
	integrations: [
		starlight({
			title: 'AgentStateGraph',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/agentstatelabs/AgentStateGraph' }],
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'guides/introduction' },
						{ label: 'Quick Start', slug: 'guides/quickstart' },
						{ label: 'Core Concepts', slug: 'guides/concepts' },
						{ label: 'Compare: Stategraph vs. StateGraph vs. AgentStateGraph', slug: 'compare' },
					],
				},
				{
					label: 'Language Guides',
					items: [
						{ label: 'MCP Server', slug: 'guides/mcp-server' },
						{ label: 'Rust', slug: 'guides/rust' },
						{ label: 'Python', slug: 'guides/python' },
						{ label: 'TypeScript', slug: 'guides/typescript' },
						{ label: 'Go', slug: 'guides/go' },
						{ label: '.NET / C#', slug: 'guides/dotnet' },
						{ label: 'Swift (macOS / iOS)', slug: 'guides/swift' },
						{ label: 'WASM / Browser', slug: 'guides/wasm' },
					],
				},
				{
					label: 'Governance & Scheduling',
					items: [
						{ label: 'Namespaces', slug: 'guides/namespaces' },
						{ label: 'Sessions', slug: 'guides/sessions' },
						{ label: 'Policy', slug: 'guides/policy' },
						{ label: 'Taint & Quarantine', slug: 'guides/taint-and-quarantine' },
						{ label: 'Tasks & plans', slug: 'guides/tasks' },
						{ label: 'Reminders', slug: 'guides/reminders' },
						{ label: 'Epochs', slug: 'guides/epochs' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'MCP Tools (73)', slug: 'reference/mcp-tools' },
						{ label: 'Binding Capabilities', slug: 'reference/capabilities' },
						{ label: 'RFC Specification', slug: 'reference/rfc' },
					],
				},
				{
					label: 'Blog',
					items: [
						{ label: 'The Missing Primitive', slug: 'blog/the-missing-primitive' },
					],
				},
			],
		}),
	],
});
