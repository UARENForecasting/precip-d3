from io import StringIO

import pandas as pd

import requests


def fetch_meiv2():
    names = 'YEAR DJ JF FM MA AM MJ JJ JA AS SO ON ND'.split(' ')
    url = 'https://psl.noaa.gov/enso/mei/data/meiv2.data'
    r = requests.get(url)
    # first line is the first and last year
    buf = StringIO(r.text); buf.readline()
    # last 4 rows contain metadata
    meiv2 = pd.read_csv(
        buf, header=None, names=names, skipfooter=4, delim_whitespace=True,
        na_values=[-999.00], engine='python'
    )
    meiv2.to_csv('data/meiv2.csv', index=False)


def combine_meiv1_v2():
    meiv1 = pd.read_csv('data/mei.csv', index_col=0)
    meiv2 = pd.read_csv('data/meiv2.csv', index_col=0)
    meiv2.columns = meiv1.columns
    meiv1_pre_v2 = meiv1.loc[:meiv2.index[0]-1]
    combined = pd.concat([meiv1_pre_v2, meiv2])
    combined.to_csv('data/mei_v1_v2.csv', float_format='%.3f')


if __name__ == '__main__':
    fetch_meiv2()
    combine_meiv1_v2()
