import { githubRequest } from '@/lib/github/client'

type FileInput = { path:string; content:string }

export async function pushProjectToGitHub(input:{
  token:string
  repoFullName:string
  baseBranch:string
  files:FileInput[]
  message:string
  branchName:string
  createPullRequest?:boolean
}) {
  const ref = await githubRequest<{object:{sha:string}}>(
    '/repos/' + input.repoFullName + '/git/ref/heads/' + encodeURIComponent(input.baseBranch),
    { token:input.token }
  )

  const baseCommit = await githubRequest<{tree:{sha:string}}>(
    '/repos/' + input.repoFullName + '/git/commits/' + ref.object.sha,
    { token:input.token }
  )

  const blobs = await Promise.all(input.files.map(async (file) => {
    const blob = await githubRequest<{sha:string}>(
      '/repos/' + input.repoFullName + '/git/blobs',
      {
        token:input.token,
        method:'POST',
        body:{ content:file.content, encoding:'utf-8' },
      }
    )
    return { path:file.path, mode:'100644', type:'blob', sha:blob.sha }
  }))

  const tree = await githubRequest<{sha:string}>(
    '/repos/' + input.repoFullName + '/git/trees',
    {
      token:input.token,
      method:'POST',
      body:{ base_tree:baseCommit.tree.sha, tree:blobs },
    }
  )

  const commit = await githubRequest<{sha:string;html_url:string}>(
    '/repos/' + input.repoFullName + '/git/commits',
    {
      token:input.token,
      method:'POST',
      body:{
        message:input.message,
        tree:tree.sha,
        parents:[ref.object.sha],
      },
    }
  )

  await githubRequest(
    '/repos/' + input.repoFullName + '/git/refs',
    {
      token:input.token,
      method:'POST',
      body:{ ref:'refs/heads/' + input.branchName, sha:commit.sha },
    }
  )

  let pullRequest:null|{number:number;html_url:string} = null
  if (input.createPullRequest !== false) {
    pullRequest = await githubRequest<{number:number;html_url:string}>(
      '/repos/' + input.repoFullName + '/pulls',
      {
        token:input.token,
        method:'POST',
        body:{
          title:'ALTIV DEV: ' + input.message,
          head:input.branchName,
          base:input.baseBranch,
          body:'Alterações geradas e revisadas no ALTIV DEV. Revise o diff antes do merge.',
        },
      }
    )
  }

  return {
    commitSha:commit.sha,
    commitUrl:commit.html_url,
    branch:input.branchName,
    pullRequest,
  }
}
