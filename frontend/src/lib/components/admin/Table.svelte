<script lang="ts">
  type Column<T> = {
    key: keyof T | 'actions';
    label: string;
    render?: (row: T) => any;
    headerRender?: () => any;
  };
  
  type Props<T> = {
    data: T[];
    columns: Column<T>[];
    keyField?: keyof T;
  }
  
  let { data, columns, keyField = 'id' }: Props<any> = $props();
</script>

<div class="overflow-x-auto w-full">
  <table class="w-full text-left table-auto min-w-[800px]">
    <thead class="bg-gray-50 border-b border-gray-200">
      <tr>
        {#each columns as col}
          <th class="px-6 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">
            {#if col.headerRender}
              {@render col.headerRender()}
            {:else}
              {col.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-200 bg-white">
      {#each data as row (row[keyField])}
        <tr class="hover:bg-gray-50 transition-colors">
          {#each columns as col}
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {#if col.render}
                {@render col.render(row)}
              {:else}
                {row[col.key]}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
      {#if data.length === 0}
        <tr>
          <td colspan={columns.length} class="px-6 py-8 text-center text-gray-500">
            No data found
          </td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
