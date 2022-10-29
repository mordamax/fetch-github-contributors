import * as dotenv from 'dotenv'
import { Octokit } from 'octokit'
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import * as fs from "fs";

dotenv.config();

const MIN_YEAR = 2010;
const years: number[] = process.env.YEARS!
  .split(',')
  .map((year) => parseInt(year, 10))
  .filter((year) => {
    const currentYear = new Date().getFullYear()
    return !isNaN(year) && year >= MIN_YEAR && year <= currentYear
  });
let repos: string[] = (process.env.REPOSITORIES || '')
  .split(',')
  .map(repo => repo.trim())
  .filter(repo => !!repo)

type ListReposForOrgResponseDataType = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.listForOrg>;
type ListCommitsResponseDataType = GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.listCommits>;

const org = process.env.GITHUB_ORG;
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});
const loadAllRepos: boolean = repos?.length === 0
// to have logs & files associated
const timestamp = `${loadAllRepos ? 'all' : 'handpicked'}_repos_${(new Date()).getTime()}`;

(async () => {
  try {
    if (loadAllRepos) {
      // load all org repos, if handpicked not provided
      repos = (await getAllReposInOrg(org!))?.map(repo => repo.name)
    } else {
      console.log(`Working with handpicked repos: ${repos}`)
    }

    const yearContributors: { [key: string]: Set<string> } = {}

    for (const repo of repos) {
      for (const yr of years) {
        yearContributors[yr] = yearContributors[yr] || new Set();
        try {
          const commits = await getCommitsInRepoByYear(org!, repo, yr)
          commits
            .map(commit => commit?.author?.login!)
            .filter(c => typeof c !== 'undefined')
            .map(async (login) => {
              if (!yearContributors[yr].has(login)) {
                yearContributors[yr].add(login)
              }
            })
        } catch (e) {
          exceptionHandler(e)
        }
      }
    }

    console.log(`${timestamp}: Done... collecting all unique contributors per org`)

    Object.keys(yearContributors).map((year) => {
      const contributorsSet = yearContributors[year];
      const contributors = [...contributorsSet.values()].join("\n")
      const fileName = `./${timestamp}_${year}.txt`;
      fs.writeFile(fileName, contributors, () => {
        console.log(`${year} saved contributors to ${fileName}`)
      })
    })
  } catch(e) {
    exceptionHandler(e)
  }
})()

async function getAllReposInOrg(org: string) {
  console.log(`Fetching all repos from org: ${org}`)
  return await getPagedData(`GET /orgs/${org}/repos`) as ListReposForOrgResponseDataType
}

async function getCommitsInRepoByYear(org: string, repo: string, year: number) {
  const since = new Date(year, 0, 1).toISOString(); // '2021-01-01T00:00:00.000Z'
  const until = new Date(year, 11, 31, 23, 59, 59).toISOString(); // '2021-12-31T23:59:59.000Z'
  console.log(`${timestamp}: Fetching commits ${org}/${repo} for ${year} year`)
  return await getPagedData(`GET /repos/${org}/${repo}/commits?since=${since}&until=${until}`) as ListCommitsResponseDataType
}

async function getPagedData(
  endpoint: string,
  page = 1,
  limit = 100,
  allResults: object[] = []
): Promise<object[]> {
  const separator = endpoint.includes('?') ? "&" : "?"
  const { data } = await octokit.request(`${endpoint}${separator}per_page=${limit}&page=${page}`)
    .catch(exceptionHandler) as { data: object[] }

  return data.length < limit
    ? allResults.concat(data)
    : await getPagedData(endpoint, page + 1, limit, allResults.concat(data))
}

function exceptionHandler(e: Error | unknown){
  console.error(e)
}
