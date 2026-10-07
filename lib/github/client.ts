type GitHubOptions = {
  token: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function githubRequest<T>(path: string, options: GitHubOptions): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : '/' + path
  const response = await fetch('https://api.github.com' + cleanPath, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + options.token,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error('GitHub API ' + response.status + ': ' + detail.slice(0, 500))
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function serverGitHubToken() {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub não configurado no servidor.')
  return token
}

// Production note:
// Prefer GitHub App/OAuth installation tokens per customer/repository.
// Do not persist personal access tokens in browser storage or logs.
